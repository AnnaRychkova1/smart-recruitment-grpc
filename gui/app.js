import express from "express";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";

const PROTO_PATH = path.join(process.cwd(), "proto", "hiring.proto");
const packageDef = protoLoader.loadSync(PROTO_PATH);
const hiringProto = grpc.loadPackageDefinition(packageDef).hiring;

// const client = new hiringProto.HiringService(
//   "localhost:50051",
//   grpc.credentials.createInsecure()
// );

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "gui", "views"));

app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.listen(3000, () => {
  console.log("🌐 Express server running at http://localhost:3000");
});
