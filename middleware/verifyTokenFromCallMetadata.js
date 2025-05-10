import jwt from "jsonwebtoken";

export function verifyTokenFromCallMetadata(call) {
  const authHeader = call.metadata.get("authorization")[0]; // "Bearer xxx"
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw {
      code: 16, // UNAUTHENTICATED
      message: "Missing or invalid authorization header",
    };
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload;
  } catch (err) {
    throw {
      code: 16, // UNAUTHENTICATED
      message: "Invalid or expired token",
    };
  }
}
