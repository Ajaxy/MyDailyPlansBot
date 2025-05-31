type AnyLiteral = Record<string, any>;
type AnyClass = new (...args: any[]) => any;
type AnyFunction = (...args: any[]) => any;
type AnyToVoidFunction = (...args: any[]) => void;
type BooleanToVoidFunction = (value: boolean) => void;
type NoneToVoidFunction = () => void;
