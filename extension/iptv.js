// TV channels for the table video, from the playlists in
// github.com/hujingguang/ChinaIPTV, with their Chinese names put into English.
// Used by the popup (popup-stream.js).

const IPTV_REPO = "https://raw.githubusercontent.com/hujingguang/ChinaIPTV/main/";

// The popup's menu of channel lists, in groups. A list is one of the repo's
// playlists ("file"), or one country's channels from otherCountry.m3u8
// ("otherCountry:<code>", by the country code its channels carry). That file
// has every channel of the repo's separate country lists and more, so it stands
// in for them. Left out: the adult list, one marked as not working, a list of
// other lists, and North Korea (its one channel is in a format the player can't play).
const IPTV_COUNTRIES = {
  au: "Australia", br: "Brazil", ca: "Canada", cu: "Cuba", fi: "Finland", fr: "France", de: "Germany",
  gr: "Greece", hk: "Hong Kong", is: "Iceland", il: "Israel", it: "Italy", jp: "Japan", mo: "Macao",
  nz: "New Zealand", no: "Norway", ph: "Philippines", pl: "Poland", ru: "Russia", rw: "Rwanda", rs: "Serbia",
  sg: "Singapore", kr: "South Korea", se: "Sweden", tw: "Taiwan", th: "Thailand", ua: "Ukraine", uk: "UK",
  us: "USA", vn: "Vietnam"
};
const IPTV_MENU = [
  ["China", [
    ["cnTV_AutoUpdate", "China (kept up to date)"],
    ["cnTV2_GuoNei", "China: national channels"],
    ["cnTV1_ALL", "China: all provinces"],
    ["cnTV1_GuoJi", "China: international"],
    ["HunanTV_AutoUpdate", "Hunan TV (kept up to date)"],
    ["HunanTV1", "Hunan TV 1"],
    ["HunanTV2", "Hunan TV 2"]
  ]],
  ["News", [["Global", "World news"]]],
  ["Countries", Object.entries(IPTV_COUNTRIES)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => ["otherCountry:" + code, name])]
];
// Lists in earlier versions of the menu, for a choice saved then.
const IPTV_RENAMED = {
  HongKong: "otherCountry:hk", Macao: "otherCountry:mo", TaiWan: "otherCountry:tw", Singapore: "otherCountry:sg",
  Japan: "otherCountry:jp", southKorea: "otherCountry:kr", Russia: "otherCountry:ru", UK: "otherCountry:uk",
  USA: "otherCountry:us"
};

// Whole names that don't translate word by word.
const IPTV_NAMES = {
  "东方卫视": "Dragon TV", "东南卫视": "Southeast TV", "凤凰香港": "Phoenix Hong Kong",
  "哈哈炫动卫视": "Toonmax TV", "金鹰卡通": "Golden Eagle Cartoon", "金鹰纪实频道": "Golden Eagle Documentary",
  "寰宇新闻台": "Global News", "东森财经新闻": "EBC Financial News", "澳亚卫视": "MASTV",
  "中国天气": "China Weather", "优购物电视购物": "UGO Shopping", "梨园频道": "Liyuan Opera",
  "留学世界": "Study Abroad World", "湖南爱晚": "Hunan Aiwan (seniors)", "信大": "Xinda TV",
  "华视HD": "CTS HD", "民视新闻HD": "FTV News HD", "中视新闻": "CTV News",
  "贵州家有购物": "Guizhou Jiayou Shopping", "新罗TV频道": "Xinluo TV", "吉林电视7频道": "Jilin TV 7",
  "港澳台": "Hong Kong, Macao & Taiwan", "卫视台": "Satellite TV", "央视台": "CCTV", "新闻频道": "News Channel"
};

// Words and places, matched longest first, so a compound wins over its parts.
const IPTV_WORDS = Object.entries({
  // Places
  "万州": "Wanzhou", "三明": "Sanming", "三沙": "Sansha", "上海": "Shanghai", "金山": "Jinshan", "上蔡": "Shangcai",
  "上虞": "Shangyu", "丘北": "Qiubei", "东北": "Northeast", "东台": "Dongtai", "东海": "Donghai", "东阳": "Dongyang",
  "个旧": "Gejiu", "中国": "China", "临平": "Linping", "临沂": "Linyi", "丽江": "Lijiang", "义马": "Yima",
  "乌兰察布": "Ulanqab", "云南": "Yunnan", "云和": "Yunhe", "伊川": "Yichuan", "伊金霍洛旗": "Ejin Horo Banner",
  "余姚": "Yuyao", "姚江": "Yaojiang", "余杭": "Yuhang", "信阳": "Xinyang", "光山": "Guangshan", "兰溪": "Lanxi",
  "兰考": "Lankao", "兵团": "Bingtuan", "内蒙古": "Inner Mongolia", "内黄": "Neihuang", "北京": "Beijing",
  "十堰": "Shiyan", "南乐": "Nanle", "南宁": "Nanning", "卫辉": "Weihui", "原阳": "Yuanyang", "厦门": "Xiamen",
  "叶县": "Ye County", "吉林": "Jilin", "哈密": "Hami", "唐河": "Tanghe", "商城": "Shangcheng", "四川": "Sichuan",
  "垫江": "Dianjiang", "大丰": "Dafeng", "大连": "Dalian", "天津": "Tianjin", "如东": "Rudong", "姜堰": "Jiangyan",
  "威海": "Weihai", "孟州": "Mengzhou", "宁夏": "Ningxia", "安多": "Amdo", "安徽": "Anhui", "安顺": "Anshun",
  "宜阳": "Yiyang", "宝丰": "Baofeng", "宿州": "Suzhou (Anhui)", "富宁": "Funing", "封丘": "Fengqiu", "尉氏": "Weishi",
  "屏边": "Pingbian", "山东": "Shandong", "山西": "Shanxi", "崇左": "Chongzuo", "崇明": "Chongming", "嵊州": "Shengzhou",
  "嵊泗": "Shengsi", "嵩县": "Song County", "巩义": "Gongyi", "平湖": "Pinghu", "平舆": "Pingyu", "广东": "Guangdong",
  "广南": "Guangnan", "广安": "Guang'an", "广西": "Guangxi", "庆元": "Qingyuan", "延安": "Yan'an", "延边": "Yanbian",
  "建安": "Jian'an", "开化": "Kaihua", "开封": "Kaifeng", "开州": "Kaizhou", "张家口": "Zhangjiakou", "德宏": "Dehong",
  "德阳": "Deyang", "忠县": "Zhong County", "成阳": "Chengyang", "房山": "Fangshan", "扬中": "Yangzhong",
  "扬州": "Yangzhou", "攀枝花": "Panzhihua", "文山": "Wenshan", "文成": "Wencheng", "新乡县": "Xinxiang County",
  "新县": "Xin County", "新安": "Xin'an", "新密": "Xinmi", "新昌": "Xinchang", "新泰": "Xintai", "新疆": "Xinjiang",
  "新蔡": "Xincai", "新郑": "Xinzheng", "新野": "Xinye", "方城": "Fangcheng", "无锡": "Wuxi", "普陀": "Putuo",
  "杞县": "Qi County", "林州": "Linzhou", "枣庄": "Zaozhuang", "桐柏": "Tongbai", "武义": "Wuyi", "武陟": "Wuzhi",
  "永嘉": "Yongjia", "永城": "Yongcheng", "汕头": "Shantou", "汝州": "Ruzhou", "汝阳": "Ruyang", "江宁": "Jiangning",
  "江苏": "Jiangsu", "江西": "Jiangxi", "池州": "Chizhou", "汤阴": "Tangyin", "沁阳": "Qinyang", "沈丘": "Shenqiu",
  "沛县": "Pei County", "沧州": "Cangzhou", "沭阳": "Shuyang", "河北": "Hebei", "河南": "Henan", "河源": "Heyuan",
  "泌阳": "Biyang", "泗洪": "Sihong", "泗阳": "Siyang", "泰州": "Taizhou", "泸州": "Luzhou", "洛宁": "Luoning",
  "洛阳": "Luoyang", "济宁": "Jining", "济源": "Jiyuan", "浙江": "Zhejiang", "钱江": "Qianjiang", "浚县": "Xun County",
  "海南": "Hainan", "海口": "Haikou", "海安": "Hai'an", "涟水": "Lianshui", "淅川": "Xichuan", "淇县": "Qi County",
  "淮安": "Huai'an", "淮阴": "Huaiyin", "深圳": "Shenzhen", "清远": "Qingyuan", "渑池": "Mianchi", "温州": "Wenzhou",
  "湖北": "Hubei", "湖南": "Hunan", "湘潭": "Xiangtan", "滁州": "Chuzhou", "滑县": "Hua County", "漳州": "Zhangzhou",
  "潢川": "Huangchuan", "澳门": "Macao", "灵宝": "Lingbao", "烟台": "Yantai", "焦作": "Jiaozuo", "甘肃": "Gansu",
  "登封": "Dengfeng", "白银": "Baiyin", "盐都": "Yandu", "眉山": "Meishan", "睢宁": "Suining", "石景山": "Shijingshan",
  "砚山": "Yanshan", "禹州": "Yuzhou", "红河县": "Honghe County", "红河": "Honghe", "绍兴": "Shaoxing", "缙云": "Jinyun",
  "罗山": "Luoshan", "舞钢": "Wugang", "舞阳": "Wuyang", "苍南": "Cangnan", "苏州": "Suzhou", "荆门": "Jingmen",
  "荣昌": "Rongchang", "荥阳": "Xingyang", "获嘉": "Huojia", "菏泽": "Heze", "萧山": "Xiaoshan", "衢江": "Qujiang",
  "襄城": "Xiangcheng", "西华": "Xihua", "西双版纳": "Xishuangbanna", "西宁": "Xining", "西平": "Xiping",
  "西畴": "Xichou", "象山": "Xiangshan", "贵州": "Guizhou", "贾汪": "Jiawang", "赣榆": "Ganyu", "辉县": "Huixian",
  "辽宁": "Liaoning", "运城": "Yuncheng", "连云港": "Lianyungang", "通许": "Tongxu", "遂平": "Suiping",
  "遂昌": "Suichang", "遵义": "Zunyi", "邯郸": "Handan", "郏县": "Jia County", "郸城": "Dancheng", "鄂尔多斯": "Ordos",
  "鄂托克旗": "Otog Banner", "鄢陵": "Yanling", "酒泉": "Jiuquan", "重庆": "Chongqing", "镇平": "Zhenping",
  "镇江": "Zhenjiang", "长垣": "Changyuan", "长沙": "Changsha", "阳江": "Yangjiang", "阳泉": "Yangquan",
  "陕西": "Shaanxi", "隆安": "Long'an", "青州": "Qingzhou", "青海": "Qinghai", "青田": "Qingtian", "项城": "Xiangcheng",
  "高邮": "Gaoyou", "鲁山": "Lushan", "鹿邑": "Luyi", "麻栗坡": "Malipo", "黑龙江": "Heilongjiang",
  "齐齐哈尔": "Qiqihar", "龙岩": "Longyan", "龙泉": "Longquan", "龙游": "Longyou", "香港": "Hong Kong",
  "台湾": "Taiwan", "福建": "Fujian", "三峡": "Three Gorges", "澜湄": "Lancang-Mekong",
  // Channel words
  "央视": "CCTV", "卫视": "Satellite TV", "中国教育电视台": "China Education TV", "教育电视台": "Education TV",
  "电视台": "TV", "电视": "TV", "频道": "", "新闻综合": "News", "综合新闻": "News", "汉语新闻综合": "Chinese News",
  "汉语综合": "Chinese General", "新闻法治": "News & Law", "公共新闻": "Public News", "新闻台": "News",
  "新闻": "News", "综合": "General", "公共农业": "Public & Farming", "公共都市": "Public City", "公共": "Public",
  "一套": "1", "二套": "2", "三套": "3", "四套": "4", "套": "",
  "影视文艺": "Film & Arts", "影视娱乐": "Film & Entertainment", "影视生活": "Film & Lifestyle", "影视": "Film & TV",
  "文化影视": "Culture & Film", "文化生活": "Culture & Lifestyle", "文化旅游": "Culture & Travel", "文化": "Culture",
  "文艺": "Arts", "文旅": "Culture & Travel", "文体": "Arts & Sports", "科教文卫": "Science, Culture & Health",
  "科教": "Science & Education", "纪实人文": "Documentary & Culture", "纪实科教": "Documentary & Science",
  "纪实": "Documentary", "纪录": "Documentary", "人文": "Culture", "生活资讯": "Lifestyle & Info",
  "生活服务": "Lifestyle & Services", "生活教育": "Lifestyle & Education", "生活娱乐": "Lifestyle & Entertainment",
  "生活": "Lifestyle", "经济生活": "Economy & Lifestyle", "经济服务": "Economy & Services", "经济旅游": "Economy & Travel",
  "经济法治": "Economy & Law", "社会经济": "Society & Economy", "城乡经济": "Town & Country Economy", "经济": "Economy",
  "经视": "Economic TV", "旅游": "Travel", "娱乐": "Entertainment", "都市资讯": "City Info", "都市生活": "City Life",
  "都市": "City", "城市": "City", "资讯": "Info", "少儿": "Kids", "卡通": "Cartoon", "体育赛事": "Sports Events",
  "综艺体育": "Variety & Sports", "体育": "Sports", "综艺": "Variety", "教育科技": "Education & Technology",
  "教育": "Education", "中文国际": "Chinese International", "国际": "International", "电影": "Movies",
  "电视剧": "Drama", "财经": "Finance", "戏曲": "Opera", "音乐": "Music", "社会与法": "Society & Law",
  "社会民生": "Society", "农业农村": "Agriculture & Rural", "农业科教": "Agriculture & Science", "农业": "Agriculture",
  "农科": "Farming & Science", "乡村党建": "Rural Party Affairs", "党建民生": "Party Affairs & Community",
  "乡村": "Rural", "三农": "Farming", "电视购物": "TV Shopping", "时尚购物": "Fashion Shopping", "购物": "Shopping",
  "民生休闲": "Community & Leisure", "民生": "Community", "休闲": "Leisure", "海洋": "Ocean", "法治": "Law",
  "蒙语": "Mongolian", "汉语": "Chinese", "俄语": "Russian", "法语": "French", "西语": "Spanish", "阿语": "Arabic",
  "空中课堂": "Air Classroom", "国家公园": "National Park", "移民": "Migrants", "未来": "Future",
  "新商都": "New Commerce", "睛彩": "Jingcai", "数字电视": "Digital TV", "天气": "Weather", "台": "TV"
}).reduce((m, [zh, en]) => m.set(zh, en), new Map());
const IPTV_LONGEST = Math.max(...[...IPTV_WORDS.keys()].map((k) => k.length));
const HAN = /[㐀-鿿]/;

// A channel or group name in English: whole-name matches first, then word by word.
// Anything not in the lists is left as it was.
function iptvEnglish(name, group = false) {
  name = name.trim();
  if (IPTV_NAMES[name]) return IPTV_NAMES[name];
  if (!HAN.test(name)) return group ? name.replace(/;/g, ", ") : name;
  if (group && name.length > 1) name = name.replace(/台$/, "");   // 河南台: Henan's channels
  const wordAt = (i) => {   // length of the longest word starting at i, or 0
    for (let len = Math.min(IPTV_LONGEST, name.length - i); len > 0; len--) {
      if (IPTV_WORDS.has(name.substr(i, len))) return len;
    }
    return 0;
  };
  const out = [];
  for (let i = 0; i < name.length;) {
    const n = HAN.test(name[i]) ? wordAt(i) : 0;
    if (n) { out.push(IPTV_WORDS.get(name.substr(i, n))); i += n; continue; }
    let j = i + 1;   // a run of anything else, kept as it is
    while (j < name.length && HAN.test(name[j]) === HAN.test(name[i]) && !(HAN.test(name[j]) && wordAt(j))) j++;
    out.push(name.slice(i, j).trim());
    i = j;
  }
  return out.filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || name;
}

// An M3U playlist: [{ name, group, country, url }] for each channel with a web
// link. The country is the code on the end of its tvg-id ("BBCNews.uk"), if any.
function iptvParse(text) {
  const channels = [];
  let info = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF")) {
      // The name follows the first comma that isn't inside a quoted attribute.
      let quoted = false, comma = -1;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') quoted = !quoted;
        else if (line[i] === "," && !quoted) { comma = i; break; }
      }
      info = {
        name: comma >= 0 ? line.slice(comma + 1).trim() : "",
        group: line.match(/group-title="([^"]*)"/)?.[1] ?? "",
        country: line.match(/tvg-id="[^"]*\.([a-z]{2})(?:@[\w-]*)?"/i)?.[1].toLowerCase() ?? ""
      };
    } else if (line && !line.startsWith("#")) {
      if (info && /^https?:\/\//i.test(line) && !/\.mpd(\?|$)/i.test(line)) channels.push({ ...info, url: line });
      info = null;
    }
  }
  return channels;
}
