// src/directives/autoScroll.js
export const autoScroll = {
    mounted(el, binding) {
      // 滚动配置
      const config = {
        speed: binding.value?.speed || 0.2, // 默认速度
        direction: binding.value?.direction || 'vertical', // 滚动方向：vertical 或 horizontal
        interval:0, // 滚动间隔(ms)
        ...binding.value
      };
      
      // 滚动状态
      let isScrolling = true;
      let scrollPosition = 0;
      let scrollInterval;
      let containerHeight = 0;
      let contentHeight = 0;
      
      // 初始化滚动
      const initScroll = () => {
        containerHeight = el.clientHeight;
        contentHeight = el.scrollHeight;
        
        // 如果内容高度小于容器高度，不需要滚动
        if (contentHeight <= containerHeight) {
          return;
        }
        
        // 开始滚动
        startScroll();
      };
      
      // 开始滚动
      const startScroll = () => {
        if (scrollInterval) clearInterval(scrollInterval);
        
        scrollInterval = setInterval(() => {
          if (!isScrolling) return;
          
          // 垂直滚动
          if (config.direction === 'vertical') {
            scrollPosition += config.speed;
            
            if (scrollPosition >= contentHeight - containerHeight) {
              scrollPosition = 0; // 重置到顶部
            }
            
            el.scrollTop = scrollPosition;
          } 
          // 水平滚动
          else {
            scrollPosition += config.speed;
            
            if (scrollPosition >= el.scrollWidth - el.clientWidth) {
              scrollPosition = 0; // 重置到左侧
            }
            
            el.scrollLeft = scrollPosition;
          }
        }, config.interval);
      };
      
      // 暂停滚动
      const pauseScroll = () => {
        isScrolling = false;
      };
      
      // 恢复滚动
      const resumeScroll = () => {
        isScrolling = true;
      };
      
      // 添加事件监听
      el.addEventListener('mouseenter', pauseScroll);
      el.addEventListener('mouseleave', resumeScroll);
      
      // 初始化
      setTimeout(initScroll, 0);
      
      // 窗口大小改变时重新计算
      const handleResize = () => {
        initScroll();
      };
      
      window.addEventListener('resize', handleResize);
      
      // 清理
      return () => {
        if (scrollInterval) clearInterval(scrollInterval);
        el.removeEventListener('mouseenter', pauseScroll);
        el.removeEventListener('mouseleave', resumeScroll);
        window.removeEventListener('resize', handleResize);
      };
    }
  };