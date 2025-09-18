import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { createApp } from './app';

// Create Express app
const app = createApp();

// Export handler for Vercel
export default async (req: VercelRequest, res: VercelResponse) => {
  // Handle CORS for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Convert Vercel request to Express request
  const expressReq = req as any;
  const expressRes = res as any;

  // Handle the request with Express app
  app(expressReq, expressRes);
};