// src/directives/index.js
import { autoScroll } from './autoScroll';
// 后续可以在这里导入其他指令

// 指令列表
const directives = {
  autoScroll,
  // 其他指令...
};

// 自动注册所有指令
export const registerDirectives = (app) => {
  Object.entries(directives).forEach(([name, directive]) => {
    app.directive(name, directive);
  });
};