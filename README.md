MEDIX


A full-stack doctor consultancy platform built using the MERN stack, designed to connect doctors and patients through a simple and user-friendly interface.

## 🚀 Features

- **Doctor Registration & Login** – Dedicated authentication for doctors.
- **Patient Registration & Login** – Patients can create accounts and securely log in.
- **Role-Based Access** – Separate authentication flows for doctors and patients.
- **Responsive UI** – Minimal and aesthetic interface with a clean design.
- **Secure Authentication** – Protected routes and authenticated user sessions.
- **Real-Time Communication** – Socket.IO integration for real-time functionality.

## 🛠️ Tech Stack

**Frontend**
- React.js
- Vite
- Tailwind CSS
- Lucide React
- React Remix Icons
- GSAP

**Backend**
- Node.js
- Express.js
- MongoDB
- Mongoose
- Socket.IO

**Authentication**
- JWT
- Google OAuth (if enabled)

## 📁 Project Structure

```text
DR-CONSULTANCY/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── hooks/
│   │   └── App.jsx
│   └── package.json
│
├── server/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── socket/
│   ├── server.js
│   └── package.json
│
└── README.md
```

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
cd DR-CONSULTANCY
```

### 2. Setup Backend

```bash
cd server
npm install
```

Create a `.env` file:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

Start the backend:

```bash
npm run dev
```

### 3. Setup Frontend

```bash
cd client
npm install
npm run dev
```

## 🔐 Environment Variables

Configure the required environment variables before running the application.

Never commit your `.env` file or expose secret credentials.

## 🎯 Project Objective

To develop a doctor consultancy platform with dedicated doctor and patient workflows, secure authentication, and real-time communication capabilities.

## 👨‍💻 Developer

**Archit Sikri**

- GitHub: [ArchitSikri](https://github.com/ArchitSikri)
- LinkedIn: [Archit Sikri](https://linkedin.com/in/archit-sikri-3741952ba)

---

⭐ If you find this project interesting, consider giving it a star!
