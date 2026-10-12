const csvInput = document.querySelector("#csv-input");
const csvFile = document.querySelector("#csv-file");
const fileName = document.querySelector("#file-name");
const delimiterSelect = document.querySelector("#delimiter");
const headerCheckbox = document.querySelector("#header-row");

const convertButton = document.querySelector("#convert-button");
const copyButton = document.querySelector("#copy-button");
const downloadButton = document.querySelector("#download-button");

const jsonOutput = document.querySelector("#json-output");
const resultInfo = document.querySelector("#result-info");
const statusMessage = document.querySelector("#status");

let convertedJSON = null;

// Exibe mensagens para o usuário
function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? "#fca5a5" : "#7dd3fc";
}

// Obtém o delimitador escolhido
function getDelimiter() {
    return delimiterSelect.value === "tab"
        ? "\t"
        : delimiterSelect.value;
}

// Interpreta o conteúdo CSV respeitando aspas
function parseCSV(text, delimiter) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    // Remove o BOM que pode existir em arquivos CSV
    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (insideQuotes) {
            if (char === '"' && nextChar === '"') {
                // Duas aspas representam uma aspa literal
                field += '"';
                i++;
            } else if (char === '"') {
                insideQuotes = false;
            } else {
                field += char;
            }

            continue;
        }

        if (char === '"') {
            // Aspas só podem começar no início de um campo
            if (field.length !== 0) {
                throw new Error(
                    "Aspas encontradas em uma posição inválida."
                );
            }

            insideQuotes = true;
        } else if (char === delimiter) {
            row.push(field);
            field = "";
        } else if (char === "\n" || char === "\r") {
            row.push(field);
            rows.push(row);

            row = [];
            field = "";

            // Trata quebras de linha do Windows (\r\n)
            if (char === "\r" && nextChar === "\n") {
                i++;
            }
        } else {
            field += char;
        }
    }

    if (insideQuotes) {
        throw new Error("Existe um campo com aspas não fechadas.");
    }

    // Adiciona os últimos dados, caso existam
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    // Ignora linhas totalmente vazias
    return rows.filter((currentRow) =>
        currentRow.some((value) => value.trim() !== "")
    );
}

// Converte as linhas CSV em uma lista de objetos
function convertCSVToJSON(text, delimiter, hasHeader) {
    const rows = parseCSV(text, delimiter);

    if (rows.length === 0) {
        throw new Error("Insira dados CSV antes de converter.");
    }

    let headers;
    let dataRows;

    if (hasHeader) {
        headers = rows[0].map((header) => header.trim());
        dataRows = rows.slice(1);

        if (headers.length === 0) {
            throw new Error("Não foi possível encontrar os cabeçalhos.");
        }

        // Impede chaves vazias ou duplicadas
        const normalizedHeaders = headers.map((header, index) =>
            header || `column_${index + 1}`
        );

        if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
            throw new Error(
                "Existem cabeçalhos duplicados. Corrija os nomes das colunas."
            );
        }

        headers = normalizedHeaders;
    } else {
        headers = rows[0].map((_, index) => `column_${index + 1}`);
        dataRows = rows;
    }

    return dataRows.map((row, rowIndex) => {
        if (row.length > headers.length) {
            throw new Error(
                `A linha ${rowIndex + (hasHeader ? 2 : 1)} possui mais colunas do que o esperado.`
            );
        }

        const object = {};

        headers.forEach((header, index) => {
            object[header] = row[index] ?? "";
        });

        return object;
    });
}

// Executa a conversão
function convertCSV() {
    try {
        const text = csvInput.value.trim();

        if (!text) {
            throw new Error("Digite ou carregue dados CSV.");
        }

        const result = convertCSVToJSON(
            text,
            getDelimiter(),
            headerCheckbox.checked
        );

        convertedJSON = JSON.stringify(result, null, 2);

        jsonOutput.textContent = convertedJSON;
        resultInfo.textContent =
            `${result.length} registro(s) convertido(s).`;

        showStatus("Conversão concluída com sucesso!");
    } catch (error) {
        convertedJSON = null;

        jsonOutput.textContent = "[]";
        resultInfo.textContent = "Não foi possível converter os dados.";

        showStatus(error.message, true);
    }
}

// Carrega um arquivo CSV
csvFile.addEventListener("change", async () => {
    const file = csvFile.files[0];

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showStatus("O arquivo deve ter no máximo 5 MB.", true);
        csvFile.value = "";
        return;
    }

    try {
        csvInput.value = await file.text();
        fileName.textContent = file.name;
        showStatus("Arquivo carregado. Clique em Converter para JSON.");
    } catch {
        showStatus("Não foi possível ler o arquivo.", true);
    }
});

// Botão de conversão
convertButton.addEventListener("click", convertCSV);

// Copia o resultado JSON
copyButton.addEventListener("click", async () => {
    if (convertedJSON === null) {
        showStatus("Converta os dados antes de copiar.", true);
        return;
    }

    try {
        await navigator.clipboard.writeText(convertedJSON);
        showStatus("JSON copiado para a área de transferência!");
    } catch {
        showStatus(
            "Não foi possível copiar. Verifique as permissões do navegador.",
            true
        );
    }
});

// Baixa o resultado como arquivo JSON
downloadButton.addEventListener("click", () => {
    if (convertedJSON === null) {
        showStatus("Converta os dados antes de baixar.", true);
        return;
    }

    const blob = new Blob(
        [convertedJSON],
        { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "converted-data.json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showStatus("Download do arquivo JSON iniciado!");
});
