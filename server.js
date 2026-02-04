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

// 3. ROTAS USUÁRIOS (mantidas para completude)
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

// 4. LÓGICA DE TRATAMENTO MW (KEYSIGHT VS VNA PORTÁTIL)
app.post('/tratar/:modulo', upload.single('arquivo'), (req, res) => {
    const { modulo } = req.params;
    if (!req.file) return res.status(400).json({ erro: "Arquivo ausente" });

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');

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
                    fonteDetectada = "Keysight (Freq, |S11|dB)";
                    dadosProcessados = dados.map(linha => ({
                        frequencia: linha[0],
                        s11_db: linha[1]
                    }));
                }
                else if (numColunas === 3) {
                    fonteDetectada = "VNA Portátil (Freq, Real, Imag)";
                    dadosProcessados = dados.map(linha => {
                        const freq = linha[0];
                        const real = linha[1];
                        const imag = linha[2];
                        const moduloLinear = Math.sqrt(Math.pow(real, 2) + Math.pow(imag, 2));
                        const s11_db = 20 * Math.log10(moduloLinear);
                        return { frequencia: freq, s11_db: s11_db.toFixed(4) };
                    });
                } else {
                    return res.status(400).json({ erro: "Formato de colunas desconhecido." });
                }

                res.json({
                    modulo: "MEDIDAS MW",
                    fonte: fonteDetectada,
                    pontos: dadosProcessados.length,
                    dadosGrafico: dadosProcessados, // Enviando TODOS os dados para o gráfico
                    mensagem: "Conversão e dados para gráfico prontos!"
                });
            } else {
                res.json({ modulo: modulo.toUpperCase(), mensagem: "Módulo em desenvolvimento." });
            }

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor MW pronto na porta ${PORT}`));
