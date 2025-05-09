import { getGrpcClientForService } from "../utils/getGrpcClientForService.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Signup
export const handleSignup = async (req, res, next) => {
  const { name, email, password } = req.body;

  console.log(name, email, password);

  const client = await getGrpcClientForService("AuthService");

  try {
    const signupRequest = {
      name,
      email,
      password: password,
    };

    const response = await new Promise((resolve, reject) => {
      client.SignUp(signupRequest, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    console.log("📦 Received from backend:", response);

    res.status(200).json({
      name: response.name,
      token: token,
    });
  } catch (err) {
    console.error("[client:auth] ❌ SignUp failed:", err.message);
    res.render("signup", { error: err.message });
  }
};

// Signin
export const handleSignin = async (req, res, next) => {
  const { email, password } = req.body;

  const client = await getGrpcClientForService("AuthService");

  try {
    const response = await new Promise((resolve, reject) => {
      client.SignIn({ email, password: password }, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({
      name: response.name,
      token: token,
    });
  } catch (err) {
    console.error("[client:auth] ❌ SignIn failed:", err.message);
    res.render("signin", { error: err.message });
  }
};
