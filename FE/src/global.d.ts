declare global {
    interface Window {
        Buffer: typeof Buffer;
    }
}

declare module '*.png' {
  const value: any;
  export default value;
}
declare module '*.jpg' {
  const value: any;
  export default value;
}
declare module '*.gif' {
  const value: any;
  export default value;
}

export {};
