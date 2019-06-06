export class ToolButton {
    isActive: boolean = false;
    isVisible: boolean = true;
    isDisabled: boolean = false;

    constructor(public id: string, public style: string, public callback, public buttonStyle: string = "") { }
}