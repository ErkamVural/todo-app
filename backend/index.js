const express = require('express');
const Redis = require('ioredis');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
const redis = new Redis({ host: process.env.REDIS_HOST, port: process.env.REDIS_PORT });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

app.get('/health', (req, res) => {
  console.log(`isteği alan container: ${process.env.HOSTNAME}`);
  res.json({ status: 'ok' });
});

app.get('/todos', async (req, res) => {
  console.log(`isteği alan container: ${process.env.HOSTNAME}`);
  // 1. cache'e bak
  const cached = await redis.get('todos');
  if (cached) {
    console.log("Veriler Redis'ten alınıyor.");
    return res.json(JSON.parse(cached)); // cache'den dön, DB'ye gitme
  }

  console.log("Veriler veritabanından alınıyor.");
  // 2. cache boşsa DB'ye git
  const result = await pool.query('SELECT * FROM todos ORDER BY id');
  
  // 3. sonucu cache'e yaz, 60 saniye sonra otomatik sil
  await redis.set('todos', JSON.stringify(result.rows), 'EX', 60);
  
  res.json(result.rows);
});

app.post('/todos', async (req, res) => {
  console.log(`isteği alan container: ${process.env.HOSTNAME}`);
  const { title } = req.body;
  const result = await pool.query(
    'INSERT INTO todos (title, done) VALUES ($1, false) RETURNING *',
    [title]
  );

  // veri değişti, cache'i sil
  await redis.del('todos');
  
  res.status(201).json(result.rows[0]);
});

app.listen(3000, () => console.log('API running on port 3000'));