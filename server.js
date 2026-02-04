const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do Multer para uploads temporários
const upload = multer({ dest: 'uploads/' });

// 1. CONEXÃO COM O MONGODB
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
.then(() => {
    console.log("✅ Conectado ao MongoDB!");
    criarAdminInicial();
})
.catch(err => console.error("❌ Erro ao conectar:", err));

// 2. MODELO DE USUÁRIO
const Usuario = mongoose.model('Usuario', {
    nome: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    cargo: { type: String, required: true }
});

async function criarAdminInicial() {
    const adminExiste = await Usuario.findOne({ nome: 'admin' });
    if (!adminExiste) {
        await new Usuario({ nome: 'admin', senha: '123', cargo: 'admin' }).save();
        console.log("👤 Admin padrão criado (admin/123)");
    }
}

// 3. ROTAS DE USUÁRIO (CRUD)
app.get('/usuarios', async (req, res) => {
    res.json(await Usuario.find());
});

app.post('/usuarios', async (req, res) => {
    try {
        const novo = new Usuario(req.body);
        await novo.save();
        res.status(201).json(novo);
    } catch (err) { res.status(400).json({ erro: "Erro ao cadastrar" }); }
});

app.put('/usuarios/:id', async (req, res) => {
    const { senha } = req.body;
    await Usuario.findByIdAndUpdate(req.params.id, { senha });
    res.json({ mensagem: "Atualizado!" });
});

app.delete('/usuarios/:id', async (req, res) => {
    await Usuario.findByIdAndDelete(req.params.id);
    res.json({ mensagem: "Removido!" });
});

app.post('/login', async (req, res) => {
    const { user, pass } = req.body;
    const u = await Usuario.findOne({ nome: user, senha: pass });
    if (u) res.json({ sucesso: true, cargo: u.cargo });
    else res.status(401).json({ sucesso: false, mensagem: "Incorreto" });
});

// 4. ROTA DE TRATAMENTO POR MÓDULO
app.post('/tratar/:modulo', upload.single('arquivo'), (req, res) => {
    const { modulo } = req.params;
    if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo enviado" });

    // Aqui a lógica mudará de acordo com o módulo no futuro
    let respostaEspecifica = "";

    switch(modulo) {
        case 'rf':
            respostaEspecifica = "Processando Medidas Dielétricas em RF...";
            break;
        case 'mw':
            respostaEspecifica = "Processando Medidas Dielétricas em MW...";
            break;
        case 'biblioteca':
            respostaEspecifica = "Acessando Biblioteca de Materiais...";
            break;
        default:
            respostaEspecifica = "Módulo desconhecido.";
    }

    const info = {
        modulo: modulo.toUpperCase(),
         arquivo: req.file.originalname,
         status: "Recebido",
         detalhes: respostaEspecifica
    };

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.json(info);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Rodando na porta ${PORT}`));
