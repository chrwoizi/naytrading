export class ToolButton {
  isActive = false;
  isVisible = true;
  isDisabled = false;

  constructor(
    public id: string,
    public style: string,
    public callback,
    public buttonStyle: string = ''
  ) {}
}
