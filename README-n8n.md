# n8n Backend Integration Guide for Class Attendance Manager

This guide explains how to set up n8n workflows and PostgreSQL database to work with the Class Attendance Manager frontend.

## 🗂️ Database Schema

### Required PostgreSQL Tables

#### 1. Users Table
```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Classes Table
```sql
CREATE TABLE classes (
    class_id SERIAL PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL,
    teacher_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. Students Table
```sql
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    student_name VARCHAR(255) NOT NULL,
    class_id INTEGER REFERENCES classes(class_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

#### 4. Attendance Table
```sql
CREATE TABLE attendance (
    attendance_id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(student_id),
    class_id INTEGER REFERENCES classes(class_id),
    attendance_date DATE NOT NULL,
    is_present BOOLEAN NOT NULL,
    month_year VARCHAR(20) NOT NULL, -- e.g., "Jul 2025"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, attendance_date)
);
```

### Indexes for Performance
```sql
CREATE INDEX idx_attendance_class_month ON attendance(class_id, month_year);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, attendance_date);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
```

## 🔄 n8n Workflow Architecture

### Recommended Workflow Structure

Create **4 separate workflows** for better organization:

1. **Authentication Workflow** (`auth-workflow`)
2. **Classes Management Workflow** (`classes-workflow`)  
3. **Students Management Workflow** (`students-workflow`)
4. **Attendance Management Workflow** (`attendance-workflow`)

## 🔐 1. Authentication Workflow

### Workflow Name: `auth-workflow`
### Webhook URL: `https://your-n8n.com/webhook/auth/login`

#### Workflow Structure:
```
Webhook → Switch → [Login Branch] → Database Query → JWT Generate → Response
                → [Invalid Route] → Error Response
```

#### Node Configuration:

**1. Webhook Node**
- HTTP Method: `POST`
- Path: `/auth/login`
- Response Mode: `Respond to Webhook`

**2. Switch Node**
- Condition: `{{ $json.body.email && $json.body.password }}`

**3. PostgreSQL Node (Login Branch)**
```sql
SELECT user_id, email, password_hash 
FROM users 
WHERE email = '{{ $json.body.email }}'
```

**4. Code Node (Password Verification)**
```javascript
const bcrypt = require('bcrypt');
const inputPassword = $input.first().json.body.password;
const storedHash = $input.first().json.password_hash;

if (bcrypt.compareSync(inputPassword, storedHash)) {
  return {
    json: {
      isValid: true,
      user_id: $input.first().json.user_id,
      email: $input.first().json.email
    }
  };
} else {
  return {
    json: {
      isValid: false
    }
  };
}
```

**5. JWT Node (Generate Token)**
```javascript
const jwt = require('jsonwebtoken');
const payload = {
  user_id: $json.user_id,
  email: $json.email,
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
};

const token = jwt.sign(payload, 'your-secret-key');

return {
  json: {
    token: token,
    user_id: $json.user_id
  }
};
```

**6. Response Node**
```json
{
  "token": "{{ $json.token }}",
  "user_id": "{{ $json.user_id }}"
}
```

## 📚 2. Classes Management Workflow

### Workflow Name: `classes-workflow`
### Webhook URL: `https://your-n8n.com/webhook/classes`

#### Workflow Structure:
```
Webhook → Auth Validation → Switch (GET/POST) → Database Query → Response
```

#### Node Configuration:

**1. Webhook Node**
- HTTP Method: `GET, POST`
- Path: `/classes`

**2. Code Node (JWT Validation)**
```javascript
const jwt = require('jsonwebtoken');
const authHeader = $input.first().json.headers.authorization;

if (!authHeader || !authHeader.startsWith('Bearer ')) {
  throw new Error('Unauthorized');
}

const token = authHeader.split(' ')[1];
try {
  const decoded = jwt.verify(token, 'your-secret-key');
  return {
    json: {
      ...decoded,
      method: $input.first().json.method,
      body: $input.first().json.body
    }
  };
} catch (error) {
  throw new Error('Invalid token');
}
```

**3. Switch Node**
- GET Branch: Fetch classes for teacher
- POST Branch: Create new class

**4. PostgreSQL Node (GET Branch)**
```sql
SELECT class_id, class_name 
FROM classes 
WHERE teacher_id = '{{ $json.user_id }}'
ORDER BY class_name
```

**5. PostgreSQL Node (POST Branch)**
```sql
INSERT INTO classes (class_name, teacher_id) 
VALUES ('{{ $json.body.class_name }}', '{{ $json.user_id }}')
RETURNING class_id, class_name
```

## 👥 3. Students Management Workflow

### Workflow Name: `students-workflow`
### Webhook URL: `https://your-n8n.com/webhook/students`

#### Workflow Structure:
```
Webhook → Auth Validation → Switch (GET/POST/DELETE) → Database Query → Response
```

#### Node Configuration:

**1. PostgreSQL Node (GET Students)**
```sql
SELECT student_id, student_name 
FROM students 
WHERE class_id = {{ $json.query.class_id }} 
AND is_active = true
ORDER BY student_name
```

**2. PostgreSQL Node (ADD Student)**
```sql
INSERT INTO students (student_name, class_id) 
VALUES ('{{ $json.body.student_name }}', {{ $json.body.class_id }})
RETURNING student_id, student_name
```

**3. PostgreSQL Node (REMOVE Student)**
```sql
UPDATE students 
SET is_active = false 
WHERE student_id = {{ $json.body.student_id }}
```

## 📊 4. Attendance Management Workflow

### Workflow Name: `attendance-workflow`
### Webhook URL: `https://your-n8n.com/webhook/add_attendance`

#### Workflow Structure:
```
Webhook → Auth Validation → Process Data → Batch Insert/Update → Response
```

#### Node Configuration:

**1. Code Node (Process Attendance Data)**
```javascript
const attendanceData = $json.body.data;
const classId = $json.body.class_id;
const month = $json.body.month;

const records = [];

attendanceData.forEach(student => {
  const studentId = student.student_id;
  
  // Process each date column (skip student_id and student_name)
  Object.keys(student).forEach(key => {
    if (key !== 'student_id' && key !== 'student_name') {
      const date = key; // e.g., "Jul 03"
      const isPresent = student[key];
      const fullDate = convertToFullDate(date, month); // Convert "Jul 03" to "2025-07-03"
      
      records.push({
        student_id: studentId,
        class_id: classId,
        attendance_date: fullDate,
        is_present: isPresent,
        month_year: month
      });
    }
  });
});

function convertToFullDate(dateStr, monthYear) {
  const [monthName, day] = dateStr.split(' ');
  const year = monthYear.split(' ')[1];
  const monthMap = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  return `${year}-${monthMap[monthName]}-${day.padStart(2, '0')}`;
}

return records.map(record => ({ json: record }));
```

**2. PostgreSQL Node (Batch Upsert)**
```sql
INSERT INTO attendance (student_id, class_id, attendance_date, is_present, month_year)
VALUES ({{ $json.student_id }}, {{ $json.class_id }}, '{{ $json.attendance_date }}', {{ $json.is_present }}, '{{ $json.month_year }}')
ON CONFLICT (student_id, attendance_date)
DO UPDATE SET 
  is_present = EXCLUDED.is_present,
  updated_at = CURRENT_TIMESTAMP
```

**3. Code Node (Count Updates)**
```javascript
const totalUpdated = $input.all().length;
const month = $input.first().json.month_year;

return {
  json: {
    ok: true,
    updated: totalUpdated,
    month: month
  }
};
```

## 🌐 CORS and Security Configuration

### CORS Headers (Add to all Response Nodes)
```json
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
}
```

### Environment Variables in n8n
Set these in your n8n environment:
```
JWT_SECRET=your-super-secure-secret-key
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=attendance_db
DB_USER=your-db-user
DB_PASSWORD=your-db-password
```

## 📋 Testing Your n8n Setup

### 1. Test Authentication
```bash
curl -X POST https://your-n8n.com/webhook/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@school.com","password":"password123"}'
```

Expected Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "96eb4c4a-4a3b-4d21-9c1a-2e8bb1f0b1ad"
}
```

### 2. Test Classes Endpoint
```bash
curl -X GET https://your-n8n.com/webhook/classes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Test Students Endpoint
```bash
curl -X GET "https://your-n8n.com/webhook/students?class_id=101" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Test Attendance Save
```bash
curl -X POST https://your-n8n.com/webhook/add_attendance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "class_id": 101,
    "class_name": "Form 2.22 English",
    "user_id": "96eb4c4a-4a3b-4d21-9c1a-2e8bb1f0b1ad",
    "month": "Jul 2025",
    "data": [
      {
        "student_id": 1,
        "student_name": "Aiden Noel",
        "Jul 03": true,
        "Jul 10": false
      }
    ]
  }'
```

## 🚀 Deployment Checklist

### Before Going Live:
- [ ] Set up PostgreSQL database with proper schema
- [ ] Configure all 4 n8n workflows
- [ ] Set environment variables for JWT secret and database credentials
- [ ] Test all endpoints with Postman or curl
- [ ] Configure CORS headers for your frontend domain
- [ ] Set up database backups
- [ ] Configure rate limiting (optional)
- [ ] Set up monitoring and logging

### Security Best Practices:
- [ ] Use strong JWT secret (at least 32 characters)
- [ ] Hash passwords with bcrypt (salt rounds: 12+)
- [ ] Validate all input data
- [ ] Use HTTPS in production
- [ ] Implement rate limiting for authentication endpoints
- [ ] Set up database connection pooling
- [ ] Regular security updates for n8n and PostgreSQL

## 🔧 Troubleshooting

### Common Issues:

**1. CORS Errors**
- Ensure CORS headers are set in all response nodes
- Check that the frontend domain is allowed

**2. Authentication Failures**
- Verify JWT secret matches between workflows
- Check token expiration settings
- Validate Authorization header format

**3. Database Connection Issues**
- Verify PostgreSQL credentials
- Check network connectivity
- Ensure database exists and tables are created

**4. Attendance Data Not Saving**
- Check date format conversion in processing node
- Verify foreign key constraints
- Check for duplicate entries

### Debug Tips:
- Enable debug mode in n8n workflows
- Use console.log in Code nodes for debugging
- Check PostgreSQL logs for database errors
- Validate JSON structure with online tools

## 📞 Support

For n8n specific issues:
- [n8n Documentation](https://docs.n8n.io/)
- [n8n Community Forum](https://community.n8n.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

This setup provides a robust, scalable backend for the Class Attendance Manager that can handle multiple teachers, classes, and students efficiently.