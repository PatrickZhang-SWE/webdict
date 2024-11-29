type RecordFormat = {
    id: number;
    name: string;
}

const html: RecordFormat = {
    id: 1,
    name: 'html'
}

export function getRecordFormat(name: string) {
    switch (name.toLowerCase()) {
        case 'html':
            return html;
        default:
            return html;
    }
}