// --- Back-end Seguro (Função Netlify) ---
// Este código deve estar no arquivo: /netlify/functions/chat.js

// Usamos 'node-fetch' para fazer requisições HTTP no ambiente Node.js do Netlify
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Permite apenas requisições do tipo POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Extrai os dados enviados pelo front-end
        const { chatHistory, userName } = JSON.parse(event.body);
        
        // Pega a chave da API do ambiente seguro do Netlify (configurada no Passo 4 do guia)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("A chave da API Gemini não está configurada no ambiente.");
        }
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        // Constrói a instrução para a IA com base no estado da conversa
        const systemInstruction = buildSystemInstruction(userName);
        
        const contents = chatHistory.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.text }],
        }));

        const payload = {
            contents,
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction }],
            },
            generationConfig: {
                temperature: userName ? 0.6 : 0.2,
                topP: 0.9,
                topK: 40,
                maxOutputTokens: 400,
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ]
        };

        // Chama a API do Gemini
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error("Gemini API Error Response:", errorBody);
            throw new Error(`API Error: ${apiResponse.statusText}`);
        }

        const data = await apiResponse.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const responseText = parts.map((p) => p.text || '').join('\n');

        // Retorna a resposta da IA para o front-end
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ responseText })
        };

    } catch (error) {
        console.error('Erro na função Netlify:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Ocorreu um erro interno no servidor.' })
        };
    }
};

function buildSystemInstruction(userName) {
    if (!userName) {
        return `Você é o Assistente Virtual ‘Dr. Supremo’. O usuário está respondendo à sua primeira pergunta: "Como você gostaria de ser chamado(a)?".
Sua ÚNICA tarefa agora é:
1. Extrair o primeiro nome do usuário do texto que ele enviou (ex: de "me chamo Fabrício", extraia "Fabrício").
2. Responder IMEDIATAMENTE e APENAS com a seguinte frase, usando o nome extraído: "Bem-vindo(a), [Nome Extraído]! Fico feliz em ajudar. Para começarmos, qual sua principal dor ou o que mais te impede de avançar hoje? Pode ser foco, autoconfiança, controle emocional ou relacionamentos."
NÃO adicione nenhuma outra palavra, saudação ou comentário. Sua resposta deve ser exclusivamente a frase acima.`;
    }

    return `Você é o Assistente Virtual ‘Dr. Supremo’ (IA). Baseie todas as respostas exclusivamente no livro ‘O Poder Supremo’. Sua missão é diagnosticar a dor do(a) ${userName}, oferecer micro‑insights práticos do livro e conduzir com ética para a aquisição do e‑book (R$ 47,00, checkout https://pay.kiwify.com.br/EQhHnRy).
Regras estritas:
1. Chame o usuário pelo primeiro nome (${userName}). Use português do Brasil (pt-BR).
2. Formato de Resposta OBRIGATÓRIO: 2 a 3 mensagens curtas por turno, separadas por uma linha em branco. Cada mensagem deve ter no máximo 280 caracteres.
3. SEMPRE termine sua última mensagem com uma pergunta para manter o diálogo ativo.
4. Cite capítulos do livro sutilmente ao dar um insight (ex: "No Cap. 1 - Auto Persuasão, abordamos isso..."). NÃO invente conteúdo. Se algo não estiver no livro, admita a limitação.
5. Sem promessas garantidas, resultados milagrosos ou conselhos clínicos/financeiros. Mantenha um tom humano, empático e encorajador.
6. Quando o usuário mostrar intenção de compra ("quero começar", "onde compro", "faz sentido", "quanto custa?"), insira em uma linha completamente isolada: [PURCHASE_BUTTON]. NENHUM outro texto deve estar nessa linha.
Mapeamento de Dores -> Capítulos:
- Falta de confiança/foco/autossabotagem: Cap. 1 (Auto Persuasão), Cap. 2 (Subconsciente).
- Controle emocional/ansiedade: Cap. 8 (Controle Emocional).
- Influência/relacionamentos/persuasão: Cap. 7 (Influência Social), Cap. 4 (Insinuação).
- Mudança de vida/visão de futuro: Cap. 10 (Manipulando o Futuro).
- Comunicação não verbal: Cap. 6.
- PNL/linguagem: Cap. 5.`;
}

