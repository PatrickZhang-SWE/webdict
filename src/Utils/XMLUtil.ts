import { XMLParser } from "fast-xml-parser";
function parseXml(xmlInput:string): any {
    const options = {
        ignoreAttributes: false,
        attributeNamePrefix : "@_"
    };
    const parser = new XMLParser(options);
    return parser.parse(xmlInput);
}