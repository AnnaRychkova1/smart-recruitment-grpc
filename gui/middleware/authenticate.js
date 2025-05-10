// middlewares/authenticate.js
import jwt from "jsonwebtoken";

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    if (req.accepts("html")) {
      return res.redirect("/signin");
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (req.accepts("html")) {
        return res.redirect("/signin");
      } else {
        return res.status(403).json({ message: "Forbidden" });
      }
    }
    req.user = user;
    next();
  });
};
