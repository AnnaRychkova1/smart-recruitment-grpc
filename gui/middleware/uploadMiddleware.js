// import multer from "multer";
// import path from "path";

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, "uploads/"),
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, `${Date.now()}-${file.fieldname}${ext}`);
//   },
// });

// export const upload = multer({ storage });

import multer from "multer";
import path from "path";

const singleFileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});

const multipleFilesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(
      null,
      `${timestamp}-${file.fieldname}-${Math.round(Math.random() * 1e9)}${ext}`
    );
  },
});

export const uploadSingle = multer({ storage: singleFileStorage });

export const uploadMultiple = multer({ storage: multipleFilesStorage });
