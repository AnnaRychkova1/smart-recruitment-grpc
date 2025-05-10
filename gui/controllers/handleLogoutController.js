export const handleLogout = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
};
