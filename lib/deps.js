// lib/deps.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { Resend } from 'resend';
import cloudinary from 'cloudinary';

dotenv.config();

export const bcrypt = bcrypt;
export const jwt = jwt;
export const upload = multer({ dest: path.join(process.cwd(), 'uploads/') });
export const resend = new Resend(process.env.RESEND_API_KEY);
export const cloudinary = cloudinary;
