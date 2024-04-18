const cloudinary = require("cloudinary").v2;
const fs = require("fs");

// import { v2 as cloudinary } from "cloudinary";
          
cloudinary.config({ 
  cloud_name: 'nik-cld-storage', 
  api_key: '294862352272933', 
  api_secret: 'SMSvPel83wRlURnx4cj0bc-nThs' 
});

module.exports = cloudinary;
