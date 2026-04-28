// 注: process.env.XX是Vercel的环境变量，配置方式见：https://docs.tangly1024.com/article/how-to-config-notion-next#c4768010ae7d44609b744e79e2f9959a

const BLOG = {
  API_BASE_URL: process.env.API_BASE_URL || 'https://www.notion.so/api/v3', // API默认请求地址,可以配置成自己的地址例如：https://[xxxxx].notion.site/api/v3
  // Important page_id！！！Duplicate Template from  https://tanghh.notion.site/02ab3b8678004aa69e9e415905ef32a5
  NOTION_PAGE_ID:
    process.env.NOTION_PAGE_ID || '897aa09ca11f45e8bdac9d2ab746b06a',
  THEME: process.env.NEXT_PUBLIC_THEME || 'heo', // 当前主题，在themes文件夹下可找到所有支持的主题；主题名称就是文件夹名，例如 example,fukasawa,gitbook,heo,hexo,landing,matery,medium,next,nobelium,plog,simple
  LANG: process.env.NEXT_PUBLIC_LANG || 'zh-CN', // e.g 'zh-CN','en-US'  see /lib/lang.js for more.
  SINCE: process.env.NEXT_PUBLIC_SINCE || 2021, // e.g if leave this empty, current year will be used.

  PSEUDO_STATIC: process.env.NEXT_PUBLIC_PSEUDO_STATIC || false, // 伪静态路径，开启后所有文章URL都以 .html 结尾。
  NEXT_REVALIDATE_SECOND: process.env.NEXT_PUBLIC_REVALIDATE_SECOND || 5, // 更新缓存间隔 单位(秒)
  APPEARANCE: process.env.NEXT_PUBLIC_APPEARANCE || 'light', // ['light', 'dark', 'auto']
  APPEARANCE_DARK_TIME: process.env.NEXT_PUBLIC_APPEARANCE_DARK_TIME || [18, 6], // 夜间模式起至时间

  AUTHOR: process.env.NEXT_PUBLIC_AUTHOR || '虾滑|Shredhub', // 您的昵称 例如 tangly1024
  BIO: process.env.NEXT_PUBLIC_BIO || '虾滑社群', // 作者简介
  LINK: process.env.NEXT_PUBLIC_LINK || 'https://shredxhub.com', // 网站地址
  KEYWORDS:
    process.env.NEXT_PUBLIC_KEYWORD || '虾滑, 滑雪, chill, 单板滑雪, 双板滑雪', // 网站关键词
  BLOG_FAVICON: process.env.NEXT_PUBLIC_FAVICON || '/favicon.ico', // blog favicon 配置
  BEI_AN: process.env.NEXT_PUBLIC_BEI_AN || '', // 备案号
  BEI_AN_LINK: process.env.NEXT_PUBLIC_BEI_AN_LINK || 'https://beian.miit.gov.cn/', // 备案查询链接
  BEI_AN_GONGAN: process.env.NEXT_PUBLIC_BEI_AN_GONGAN || '', // 公安备案号

  // RSS订阅
  ENABLE_RSS: process.env.NEXT_PUBLIC_ENABLE_RSS || true, // 是否开启RSS订阅功能

  // 其它复杂配置
  ...require('./conf/comment.config'),
  ...require('./conf/contact.config'),
  ...require('./conf/post.config'),
  ...require('./conf/analytics.config'),
  ...require('./conf/image.config'),
  ...require('./conf/font.config'),
  ...require('./conf/right-click-menu'),
  ...require('./conf/code.config'),
  ...require('./conf/animation.config'),
  ...require('./conf/widget.config'),
  ...require('./conf/ad.config'),
  ...require('./conf/plugin.config'),
  ...require('./conf/performance.config'),

  // 高级用法
  ...require('./conf/layout-map.config'),
  ...require('./conf/notion.config'),
  ...require('./conf/dev.config'),

  // 自定义外部脚本，外部样式
  CUSTOM_EXTERNAL_JS: [''],
  CUSTOM_EXTERNAL_CSS: [''],

  // 自定义菜单
  CUSTOM_MENU: process.env.NEXT_PUBLIC_CUSTOM_MENU || false,

  // 文章列表相关设置
  CAN_COPY: process.env.NEXT_PUBLIC_CAN_COPY || true,

  // 侧栏布局 是否反转(左变右,右变左)
  LAYOUT_SIDEBAR_REVERSE:
    process.env.NEXT_PUBLIC_LAYOUT_SIDEBAR_REVERSE || false,

  // 欢迎语打字效果
  GREETING_WORDS: process.env.NEXT_PUBLIC_GREETING_WORDS || '',

  // Shredxhub 定制覆盖
  CONTACT_EMAIL:
    (process.env.NEXT_PUBLIC_CONTACT_EMAIL &&
      btoa(
        unescape(encodeURIComponent(process.env.NEXT_PUBLIC_CONTACT_EMAIL))
      )) ||
    'aW5mb0BzaHJlZHhodWIuY29t',
  CONTACT_INSTAGRAM:
    process.env.NEXT_PUBLIC_CONTACT_INSTAGRAM ||
    'https://www.instagram.com/shredxhub/',
  POST_URL_PREFIX: process.env.NEXT_PUBLIC_POST_URL_PREFIX || 'category',
  WIDGET_PET: process.env.NEXT_PUBLIC_WIDGET_PET || false,
  COMMENT_GITTER_ROOM:
    process.env.NEXT_PUBLIC_COMMENT_GITTER_ROOM ||
    'https://matrix.to/#/!mDTbDrANZTqoDVUMlT:gitter.im?via=gitter.im',
  CLARITY_ID: process.env.NEXT_PUBLIC_CLARITY_ID || 'qisc0stni6',
  TITLE: process.env.NEXT_PUBLIC_TITLE || '虾滑|Shredhub',
  DESCRIPTION: process.env.NEXT_PUBLIC_DESCRIPTION || '虾滑滑雪社群的主页',

  // uuid重定向至 slug
  UUID_REDIRECT: process.env.UUID_REDIRECT || false
}

module.exports = BLOG
