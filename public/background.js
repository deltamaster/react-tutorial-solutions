// 创建右键菜单项
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyzePage',
    title: 'Analyze Page',
    contexts: ['page']
  });
});

// 监听右键菜单项点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyzePage') {
    // 注入脚本获取页面HTML
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getPageHTML
    }, (results) => {
      if (results && results[0] && results[0].result) {
        const html = results[0].result;
        
        // 处理HTML：提取body部分并移除标签属性
        const processedHtml = processHtmlForConversion(html);
        
        // 将处理过的HTML包装在```html和```之间
        const formattedHtml = `Please Analyze the page content:

\`\`\`html
${processedHtml}
\`\`\`
`;
        
        // 使用Chrome storage API存储内容
        chrome.storage.local.set({ 
          pageContent: { type: 'html', content: formattedHtml },
          contentTimestamp: Date.now()
        }, () => {
          console.log('Stored processed HTML in Chrome storage');
          // 打开扩展页面
          chrome.tabs.create({
            url: chrome.runtime.getURL('index.html?content=stored')
          });
        });
      }
    });
  }
});

// 从页面获取HTML的函数
function getPageHTML() {
  return document.documentElement.outerHTML;
}

// 处理HTML，提取body部分，移除iframe、script、style、svg标签，移除标签属性、HTML注释、空元素和空行
function processHtmlForConversion(html) {
  try {
    // 提取body部分
    let bodyContent = html;
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      bodyContent = bodyMatch[1];
      console.log('Extracted body content from HTML');
    } else {
      console.log('No body tag found, using entire HTML');
    }
    
    // 移除特定标签及其内容
    bodyContent = bodyContent.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
    bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    bodyContent = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    bodyContent = bodyContent.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
    
    // 移除HTML注释
    bodyContent = bodyContent.replace(/<!--[\s\S]*?-->/g, '');
    
    // 移除标签属性，保留href和src属性
    bodyContent = bodyContent.replace(/<([a-z][a-z0-9]*)\s*([^>]*)>/gi, function(match, tagName, attributes) {
      let preservedAttributes = [];
      
      // 保留href属性
      const hrefMatch = attributes.match(/href="[^"]*"/);
      if (hrefMatch) preservedAttributes.push(hrefMatch[0]);
      
      // 保留src属性
      const srcMatch = attributes.match(/src="[^"]*"/);
      if (srcMatch) preservedAttributes.push(srcMatch[0]);
      
      return `<${tagName}${preservedAttributes.length > 0 ? ' ' + preservedAttributes.join(' ') : ''}>`;
    });
    
    // 移除空元素（没有内容的元素），需要循环处理直到没有变化
    let previousLength;
    do {
      previousLength = bodyContent.length;
      bodyContent = bodyContent.replace(/<([a-z][a-z0-9]*)>\s*<\/\1>/gi, '');
    } while (bodyContent.length !== previousLength);
    
    // 删除空行
    bodyContent = bodyContent.replace(/^\s*\n/gm, '');
    
    // 删除行首和行尾的空白字符
    bodyContent = bodyContent.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
    
    return bodyContent;
  } catch (error) {
    console.error('Error processing HTML:', error);
    return html; // 如果处理失败，返回原始HTML
  }
}

// 注意：不再需要Markdown转换函数，直接使用处理过的HTML

// 获取API密钥 - 与AppContent.js中使用的存储机制保持一致
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiKey'], (result) => {
      if (result.apiKey) {
        console.log('Retrieved API key from Chrome sync storage');
        resolve(result.apiKey);
      } else {
        console.log('No API key found in Chrome sync storage');
        resolve('');
      }
    });
  });
}

// 点击扩展图标时打开扩展页面
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});