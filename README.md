# 🧠 Smart Recruitment System (Node.js + Express + gRPC + EJS)

Welcome to the Smart Recruitment System — a distributed application for managing the full recruitment pipeline: candidate registration, AI-adding, AI-filtering, scheduling interviews, and user authentication. It leverages **Node.js**, **gRPC**, **Express**, and **MongoDB**, with a **dynamic EJS frontend**.

---

## 🚀 Technologies Used

| Tech Stack                                                                                               | Description                 |
| -------------------------------------------------------------------------------------------------------- | --------------------------- |
| ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)        | Backend Runtime             |
| ![Express](https://img.shields.io/badge/Express.js-000000?style=flat&logo=express&logoColor=white)       | Server Framework            |
| ![gRPC](https://img.shields.io/badge/gRPC-0000FF?style=flat&logo=grpc&logoColor=white)                   | Microservices Communication |
| ![MongoDB](https://img.shields.io/badge/MongoDB-4DB33D?style=flat&logo=mongodb&logoColor=white)          | NoSQL Database              |
| ![EJS](https://img.shields.io/badge/EJS-3178C6?style=flat&logo=ejs&logoColor=white)                      | Dynamic Frontend Templates  |
| ![HTML/CSS](https://img.shields.io/badge/HTML5/CSS3-E34F26?style=flat&logo=html5&logoColor=white)        | UI Markup & Styling         |
| ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black) | Client-side Logic           |

---

## 🧩 Services Architecture

This app follows a **modular microservice structure** with gRPC communication and HTTP endpoints.

---

![Architecture](./screenshots/Architecture1.png)

---

### 🔐 Auth Service (`/services/auth`)

Handles user registration and login.

- `POST /api/signup` – Create user
- `POST /api/signin` – Log in user

> 🔒 Passwords are securely hashed using **bcrypt** before being stored in the database.
> 🔑 Upon login, users receive a **JWT (JSON Web Token)**, valid for **1 hour**, used for authenticated access to protected endpoints.
> 🚪 Logout functionality is implemented only on the client side.

---

### 👤 Hiring Service (`/services/hiring`)

CRUD operations for candidates, including CV upload.

- `POST /add-candidate` – Add candidate
- `POST /bulk-add-candidates` – Upload multiple candidate CVs. Each CV is parsed and analyzed using AI to automatically extract structured data (name, email, position, experience) before saving to the database.
- `GET /get-candidates` – Get all candidates
- `PUT /update-candidate/:id` – Edit candidate
- `DELETE /delete-candidate/:id` – Remove candidate

> Accepts `multipart/form-data` for file uploads.

---

### 🧹 Filtering Service (`/services/filtering`)

Filter and clean candidate lists.

- `GET /filter-candidates` – Applies filters (by experience, position) on the server and returns a list of candidates matching the criteria. Additionally, it parses and analyzes each candidate's CV using AI (triggered server-side). Candidate data is fetched directly from the database.
- `DELETE /delete-filtered/:id` – Remove candidate from filtered list

> Extracts and evaluates CV content using `pdf-parse` for resume analysis.

---

### 📅 Interview Service (`/services/interview`)

Schedule, edit, and remove interviews.

- `POST /schedule-interviews` – Schedule interviews for the selected date with filtered candidates (candidate data is fetched directly from the server-side database) and retrieve the full interview schedule.
- `POST /reschedule-interviews` – Reschedule all interview
- `PUT /update-interview/:id` – Change one interview
- `DELETE /delete-interview/:id` – Cancel interview

---

## 🌐 Client Side (`/gui/views`)

Built with **EJS templates** and vanilla JS for interactivity:

- `index.ejs`: Main dashboard
- `signup.ejs`: Registration page
- `signin.ejs`: Login page

Client uses **`/js/*.js`** scripts for AJAX communication with the services.

---

## 📂 Project Structure

```bash
├── discovery             # gRPC service discovery logic
├── gui                   # Express-based HTTP interface (web client)
│   ├── controllers       # Logic for handling incoming HTTP requests (view controllers)
│   ├── middleware        # Custom Express middleware (authentication)
│   ├── routes            # HTTP route definitions and mappings
│   ├── utils             # Utility and helper functions for the GUI layer
│   ├── views             # EJS templates rendered on the server side
│   └── app.js            # Entry point for the Express web server
├── helpers               # AI helper functions (for candidate filtering)
├── middleware            # Shared middleware for gRPC services (token verification)
├── models                # Mongoose schemas for MongoDB collections
├── proto                 # gRPC .proto interface definitions
├── public                # Static frontend assets (CSS, JS, images)
├── screenshots           # UI screenshots and demo images
├── services              # gRPC microservices (auth, hiring, filtering, interview)
├── uploads               # Uploaded CV/resume files
├── .env                  # Environment variable definitions
├── .gitignore            # Git ignored files and directories
├── package.json          # Project metadata and dependencies
├── package-lock.json     # Exact versions of installed dependencies
└── README.md             # Project documentation
```

---

## 📸 UI Preview

| Hiring                                    | Filtering                                        | Interview                                          |
| ----------------------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| ![UI](./screenshots/Interface/Hiring.png) | ![Filter](./screenshots/Interface/Filtering.png) | ![Schedule](./screenshots/Interface/Scheduled.png) |

### To explore more details, open the folder 📂 `./screenshots/Interface`

## ⚙️ Getting Started

### 🧱 Project Structure & Modules

This project uses **native ES Modules**, enabled via the following in `package.json`:

```json
{
  "type": "module"
}
```

Use `import`/`export` syntax (instead of CommonJS `require`). Make sure you're running **Node.js v14+** for full support.

---

### ⚙️ Run the Application

To run all services in parallel with minimal terminal noise (ideal for demo or production), use:

#### ▶️ Start All Services

```bash
npm install
npm run discovery
npm start
```

This launches the following:

- 🧑 Auth Service — `services/auth/server.js`
- 📋 Hiring Service — `services/hiring/server.js`
- 🧠 Filtering Service — `services/filtering/server.js`
- 📆 Interview Service — `services/interview/server.js`
- 🌐 GUI Client — `gui/app.js`

All services run in parallel using the `concurrently` package.
The Discovery service is run separately to ensure it starts **before** the other services, allowing time for proper service registration and availability.

---

### 🖼️ Demo & Screenshots

#### Auth Service

![POST /api/signup](./screenshots/Postman/Signup.png)
![POST /api/signin](./screenshots/Postman/Signin.png)

#### HiringService

![POST /add-candidate](./screenshots/Postman/AddCandidate.png)
![POST /bulk-add-candidates](./screenshots/Postman/AddManyCandidates.png)
![GET /get-candidates](./screenshots/Postman/GetCandidates.png)
![PUT /update-candidate/:id](./screenshots/Postman/UpdateCandidate.png)
![DELETE /delete-candidate/:id](./screenshots/Postman/DeleteCandidate.png)

### FilteringService

![GET /filter-candidates](./screenshots/Postman/FilterCandidates.png)
![DELETE /delete-filtered/:id](./screenshots/Postman/DeleteFiltered.png)

### InterviewService

![POST /schedule-interviews](./screenshots/Postman/ScheduleInterviews.png)
![POST /schedule-interviews](./screenshots/Postman/ScheduleInterviews1.png)
![POST /reschedule-interviews](./screenshots/Postman/StreamAndReschedule.png)
![PUT /update-interview/:id](./screenshots/Postman/UpdateInterview.png)
![DELETE /delete-interview/:id](./screenshots/Postman/DeleteInterview.png)

---

### 3. Open in browser

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Key Features

- 🔒 User Authentication (Signup, Login, JWT)
- 📥 Add/Edit/Delete Candidates with CV upload
- 🤖 Bulk upload candidate CVs with automatic data extraction powered by AI
- 🔍 Filter candidates by experience and position
- 📅 Schedule and manage interview dates, reschedule
- 📂 Fully modular architecture using gRPC

---

## 📜 License

This project is developed as part of the **Distributed Systems** coursework by
Anna Rychkova | NCI | Student No. 23180188

---
