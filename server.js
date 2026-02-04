const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const Papa = require('papaparse');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// 1. CONEXÃO MONGODB
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI).then(() => {
    console.log("✅ Conectado ao MongoDB!");
    criarAdminInicial();
}).catch(err => console.error(err));

// 2. MODELO USUÁRIO
const Usuario = mongoose.model('Usuario', {
    nome: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    cargo: { type: String, required: true }
});

async function criarAdminInicial() {
    const adminExiste = await Usuario.findOne({ nome: 'admin' });
    if (!adminExiste) {
        await new Usuario({ nome: 'admin', senha: '123', cargo: 'admin' }).save();
    }
}

// 3. ROTAS USUÁRIOS
app.get('/usuarios', async (req, res) => res.json(await Usuario.find()));
app.post('/usuarios', async (req, res) => {
    try { const n = new Usuario(req.body); await n.save(); res.status(201).json(n); }
    catch (e) { res.status(400).json({erro: "Erro"}); }
});
app.put('/usuarios/:id', async (req, res) => {
    await Usuario.findByIdAndUpdate(req.params.id, { senha: req.body.senha });
    res.json({ok: true});
});
app.delete('/usuarios/:id', async (req, res) => {
    await Usuario.findByIdAndDelete(req.params.id);
    res.json({ok: true});
});
app.post('/login', async (req, res) => {
    const { user, pass } = req.body;
    const u = await Usuario.findOne({ nome: user, senha: pass });
    if (u) res.json({ sucesso: true, cargo: u.cargo });
    else res.status(401).json({ sucesso: false });
});

// 4. LÓGICA DE TRATAMENTO MW
app.post('/tratar/:modulo', upload.single('arquivo'), (req, res) => {
    const { modulo } = req.params;
    if (!req.file) return res.status(400).json({ erro: "Arquivo ausente" });

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Usando PapaParse para ler o CSV/TXT
    Papa.parse(fileContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
            let resposta = { modulo: modulo.toUpperCase(), arquivo: req.file.originalname };

            if (modulo === 'mw') {
                // Exemplo de lógica para MW: Calcular média de uma coluna chamada 'permissividade' ou 'epsilon'
                const dados = results.data;
                const campoAlvo = dados[0].epsilon || dados[0].permissividade || Object.keys(dados[0])[1]; // Tenta achar a coluna

                const soma = dados.reduce((acc, curr) => acc + (curr[campoAlvo] || 0), 0);
                const media = (soma / dados.length).toFixed(4);

                resposta.detalhes = `Processadas ${dados.length} linhas. Média de ${campoAlvo}: ${media}`;
            } else {
                resposta.detalhes = "Arquivo recebido. Lógica para este módulo ainda em desenvolvimento.";
            }

            fs.unlinkSync(filePath); // Limpa o arquivo temporário
            res.json(resposta);
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Porta ${PORT}`));
