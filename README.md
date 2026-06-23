# 🎓 Campus Connect

<p align="center">
  <img src="README-assets/dashboard.png" width="95%">
</p>

<p align="center">
A full-stack campus collaboration platform built with <b>React</b>, <b>Node.js</b>, <b>Express</b>, <b>PostgreSQL</b>, <b>Socket.IO</b>, and <b>Cloudinary</b>.
</p>

<p align="center">

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?logo=postgresql)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-black)
![License](https://img.shields.io/badge/License-MIT-green)

</p>

---

# ✨ Features

- 🔐 Secure JWT Authentication
- 👨‍🎓 Student & Faculty Accounts
- 📚 Study Material Upload & Download
- ☁️ Cloudinary File Storage
- 💬 Real-Time Chat (Socket.IO)
- 👥 Study Groups
- 📢 Announcements
- 🛠 Admin Dashboard
- 👤 Profile Management
- 📊 PostgreSQL Database

---

# 🛠 Tech Stack

| Category | Technologies |
|-----------|-------------|
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Neon) |
| Authentication | JWT, bcryptjs |
| Real-time | Socket.IO |
| Storage | Cloudinary |
| Styling | CSS |

---

# 📸 Application Screenshots

## Authentication

<p align="center">

<img src="README-assets/login.png" width="48%">

<img src="README-assets/register.png" width="48%">

</p>

---

## Dashboard

<p align="center">

<img src="README-assets/dashboard.png" width="95%">

</p>

---

## Files & Uploads

<p align="center">

<img src="README-assets/files.png" width="48%">

<img src="README-assets/upload.png" width="48%">

</p>

---

## Real-Time Chat

<p align="center">

<img src="README-assets/chat.png" width="95%">

</p>

---

## Study Groups

<p align="center">

<img src="README-assets/create_group.png" width="48%">

<img src="README-assets/group.png" width="48%">

</p>

---

## Profile

<p align="center">

<img src="README-assets/profile.png" width="70%">

</p>

---

# 🏗 Project Structure

```text
backend/
frontend/
README-assets/
README.md
```

---

# 🚀 Getting Started

## Clone Repository

```bash
git clone https://github.com/chitrak-cs/Collage-Connect.git
```

```bash
cd Collage-Connect
```

---

## Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Runs on

```
http://localhost:5001
```

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on

```
http://localhost:5173
```

---

# 🔑 Environment Variables

```env
PORT=

DATABASE_URI=

JWT_SECRET=

JWT_EXPIRES_IN=

CLOUDINARY_CLOUD_NAME=

CLOUDINARY_API_KEY=

CLOUDINARY_API_SECRET=

CLIENT_URL=
```

---

# 📡 REST API

| Method | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Register |
| GET | /api/files | Files |
| POST | /api/files/upload | Upload |
| GET | /api/groups | Groups |
| GET | /api/messages/global | Chat |
| GET | /api/admin/stats | Admin |

---

# 💡 Skills Demonstrated

- Authentication
- REST APIs
- PostgreSQL
- Database Design
- CRUD Operations
- WebSockets
- Cloudinary Integration
- Role Based Authorization
- Responsive UI
- React Context API
- Express Middleware
- File Upload Handling

---

# 🔮 Future Improvements

- Push Notifications
- PDF Preview
- Dark Mode
- Search
- AI Study Assistant
- Mobile App
- Video Calling

---

# 🌍 Deployment

Frontend

```
Vercel
```

Backend

```
Render
```

Database

```
Neon PostgreSQL
```

Storage

```
Cloudinary
```

---

# 👨‍💻 Author

**Chitrak Betal**

GitHub

```
https://github.com/chitrak-cs
```

LinkedIn

```
https://www.linkedin.com/in/chitrak-betal-a5398431a/?skipRedirect=true
```

---

# ⭐ If you like this project

Give it a ⭐ on GitHub.