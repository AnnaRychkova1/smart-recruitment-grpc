// import { startHiringService } from "../../services/hiring/server.js";

// const hiringController = {
//   addCandidate: (req, res, next) => {
//     try {
//       const { id, name, email, position, experience } = req.body;
//       const cvFile = req.file;

//       if (!cvFile) {
//         return res.status(400).send("CV file is required.");
//       }

//       // startHiringService();

//       const candidateData = {
//         id: id ? parseInt(id, 10) : Date.now(),
//         name,
//         email,
//         position,
//         experience: parseInt(experience, 10),
//         pathCV: cvFile.filename,
//       };

//       req.grpcClients.hiring.addCandidate(candidateData, (error, response) => {
//         if (error) {
//           console.error("gRPC error:", error);
//           return next(error);
//         }

//         res.render("index", {
//           message: response?.message || "Candidate added successfully!",
//           candidates: null,
//         });
//       });
//     } catch (err) {
//       next(err);
//     }
//   },

//   getAllCandidates: (req, res, next) => {
//     req.grpcClients.hiring.getAllCandidates({}, (error, response) => {
//       if (error) {
//         console.error("gRPC error:", error);
//         return next(error);
//       }

//       res.render("index", {
//         candidates: response?.candidates || [],
//         message: null,
//       });
//     });
//   },
// };

// export default hiringController;
