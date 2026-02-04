const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const Papa = require('papaparse');

const app = express();
app.use(cors());
app.use(express.json());

// Pasta temporária para arquivos
const upload = multer({ dest: 'uploads/' });

// 1. CONEXÃO MONGODB
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI).then(() => {
    console.log("✅ Conectado ao MongoDB!");
    criarAdminInicial();
}).catch(err => console.error("Erro Mongo:", err));

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

// 3. ROTAS DE ACESSO
app.post('/login', async (req, res) => {
    const { user, pass } = req.body;
    const u = await Usuario.findOne({ nome: user, senha: pass });
    if (u) res.json({ sucesso: true, cargo: u.cargo });
    else res.status(401).json({ sucesso: false });
});

app.get('/usuarios', async (req, res) => res.json(await Usuario.find()));

// 4. LÓGICA DE TRATAMENTO MW
app.post('/tratar/:modulo', upload.single('arquivo'), (req, res) => {
    const { modulo } = req.params;

    if (!req.file) {
        return res.status(400).json({ erro: "Arquivo não recebido pelo servidor." });
    }

    try {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');

        Papa.parse(fileContent, {
            header: false,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                let dadosProcessados = [];
                let fonteDetectada = "";
                const dados = results.data;

                if (modulo === 'mw') {
                    const numColunas = dados[0].length;

                    if (numColunas === 2) {
                        fonteDetectada = "Keysight (2 colunas)";
                        dadosProcessados = dados.map(linha => ({
                            frequencia: linha[0],
                            s11_db: linha[1]
                        }));
                    }
                    else if (numColunas === 3) {
                        fonteDetectada = "VNA Portátil (3 colunas)";
                        dadosProcessados = dados.map(linha => {
                            const real = linha[1];
                            const imag = linha[2];
                            const moduloLinear = Math.sqrt(Math.pow(real, 2) + Math.pow(imag, 2));
                            const db = 20 * Math.log10(moduloLinear);
                            return { frequencia: linha[0], s11_db: db.toFixed(4) };
                        });
                    }
                }

                // Remove arquivo temporário
                fs.unlinkSync(req.file.path);

                res.json({
                    sucesso: true,
                    fonte: fonteDetectada,
                    pontos: dadosProcessados.length,
                    dadosGrafico: dadosProcessados
                });
            }
        });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao processar arquivo." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));
