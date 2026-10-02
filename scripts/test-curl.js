const http = require('http');
const fs = require('fs');

// Read .env manually
const envContent = fs.readFileSync('.env', 'utf8');
const jwtMatch = envContent.match(/JWT_SECRET="?([^"\r\n]+)"?/);
const JWT_SECRET = jwtMatch ? jwtMatch[1] : 'sms-saas-production-jwt-secret-replace-me-random-64-chars';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate a token for a real user in the DB
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({
    include: { tenant: true },
  });

  if (!user) {
    console.log('No user in DB');
    return;
  }

  console.log('Testing with User:', user.email, 'Role:', user.role);

  const token = jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      subdomain: user.tenant.subdomain,
      jti: crypto.randomUUID(),
    },
    JWT_SECRET,
    { expiresIn: '8h', algorithm: 'HS512' }
  );

  const req = http.request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/operations/assets',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.log('HTTP STATUS:', res.statusCode);
        console.log('HTTP BODY:', data);
      });
    }
  );

  req.on('error', (e) => {
    console.error('Request error:', e);
  });

  req.end();
}

run().finally(() => prisma.$disconnect());
