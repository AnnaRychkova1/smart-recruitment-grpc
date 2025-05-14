import { getGrpcClientForService } from "../utils/getGrpcClientForService.js";

// Signup
export const handleSignup = async (req, res, next) => {
  const { name, email, password } = req.body;

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

    console.log("[client:auth]📦 Received from backend:", response);

    res.status(200).json({
      name: response.name,
      token: response.token,
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

    console.log("[client:auth]📦 Received from backend:", response);

    res.status(200).json({
      name: response.name,
      token: response.token,
    });
  } catch (err) {
    console.error("[client:auth] ❌ SignIn failed:", err.message);
    res.render("signin", { error: err.message });
  }
};
