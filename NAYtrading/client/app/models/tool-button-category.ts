import { ToolButton } from './tool-button';

export class ToolButtonCategory {
    constructor(public name: string, public style: string, public caption: string, public tools: ToolButton[]) { }
}