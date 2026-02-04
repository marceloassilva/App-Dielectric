const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Configurações de Middleware
app.use(cors());
app.use(express.json());

// 1. CONEXÃO COM O MONGODB
// No Render, configuraremos essa variável "MONGO_URI" no painel de controle
const mongoURI = process.env.MONGO_URI || "Sua_URL_De_Teste_Aqui_Se_Quiser";

mongoose.connect(mongoURI)
.then(() => console.log("✅ Conectado ao MongoDB com sucesso!"))
.catch(err => console.error("❌ Erro ao conectar ao MongoDB:", err));

// 2. MODELO DE USUÁRIO
const Usuario = mongoose.model('Usuario', {
    nome: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    cargo: { type: String, required: true }
});

// 3. ROTAS
app.get('/', (req, res) => res.send("API de Tratamento de Dados Online! 🚀"));

app.get('/usuarios', async (req, res) => {
    try {
        const lista = await Usuario.find();
        res.json(lista);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar usuários" });
    }
});

app.post('/usuarios', async (req, res) => {
    try {
        const novo = new Usuario(req.body);
        await novo.save();
        res.status(201).json(novo);
    } catch (err) {
        res.status(400).json({ erro: "Erro ao cadastrar ou usuário já existe." });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { user, pass } = req.body;
        const usuarioEncontrado = await Usuario.findOne({ nome: user, senha: pass });

        if (usuarioEncontrado) {
            res.json({ sucesso: true, cargo: usuarioEncontrado.cargo });
        } else {
            res.status(401).json({ sucesso: false, mensagem: "Usuário ou senha inválidos" });
        }
    } catch (err) {
        res.status(500).json({ erro: "Erro no servidor" });
    }
});

// 4. PORTA DINÂMICA (Essencial para o Render/Railway)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
