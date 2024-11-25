type LanguageMeta = {
    id: number,
    name: string,
    code: string,
    lang: string,
}

const chinese: LanguageMeta = {id: 1, name: '中文', code: 'zh-CN', lang: 'zh-CN'};
const english: LanguageMeta = {id: 2, name: 'English', code: 'en-US', lang: 'en-US'};
const japanese: LanguageMeta = {id: 3, name: '日本語', code: 'ja-JP',  lang: 'ja-JP'};

export function getLanguageMeta(code: string) {
    switch (code) {
        case 'zh-CN':
            return chinese;
        case 'en-US':
            return english;
        case 'ja-JP':
            return japanese;
        default:
            throw new Error(`Unsupported language code: ${code}`);
    }
}