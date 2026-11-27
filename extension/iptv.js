// TV channels for the TV window, from public playlists on GitHub, with Chinese
// names put into English. Used by the TV window's guide (stream-guide.js) and
// the popup's TV on the table menu (popup-stream.js).
//
// Sources:
//  - ChinaIPTV (github.com/hujingguang/ChinaIPTV): China's channels, world news,
//    and otherCountry.m3u8, channels from 30 countries (tvg-id "Name.uk").
//  - iptv-org (github.com/iptv-org/iptv, public domain): the big community index,
//    a playlist per country (countries/<code>.m3u) and one of international ones.
//  - Free-TV (github.com/Free-TV/IPTV): free-to-air channels, tagged by country.
// A country in the menu is all three put together, without repeats, plus any
// channels added by hand (IPTV_EXTRA); China also has ChinaIPTV's China lists.

const IPTV_REPO = "https://raw.githubusercontent.com/hujingguang/ChinaIPTV/main/";
const IPTV_ORG = "https://iptv-org.github.io/iptv/";
const IPTV_FREETV = "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8";

// Channels added by hand to a country's list: the broadcasters' and distributors'
// own free streams that the playlists above don't file under that country (most
// are free, ad-supported channels made for smart TVs and apps such as Rakuten TV,
// FASTV and Samsung TV Plus). Each was tested when added; dead ones are hidden like
// any other. [name, link, group]: a group the list already has gets the channel at
// its end; a new group goes at the top of the list, in the order given here.
const IPTV_EXTRA = {
  kr: [
    ["K-Content by CJ ENM", "https://d2q0mzb9bm4w5z.cloudfront.net/68fee8e1_605a_437b_b968_244c3c0d5f24/hls/playlist.m3u8", "K-drama, films & K-pop"],
    ["NEW K.Movies", "https://ads.its-newid.net/api/manifest.m3u8?ads.service_id=GB1700007PK&channel_id=newid_343&tp=samsung_tvplus", "K-drama, films & K-pop"],
    ["Rakuten Viki", "https://fd18f1cadd404894a31a3362c5f319bd.mediatailor.us-east-1.amazonaws.com/v1/master/04fd913bb278d8775298c26fdca9d9841f37601f/RakutenTV-eu_RakutenViki-1/playlist.m3u8", "K-drama, films & K-pop"],
    ["AsianCrush", "https://linear-900.frequency.stream/dist/cineverse/900/hls/master/playlist.m3u8", "K-drama, films & K-pop"],
    ["NEW K-Pop", "https://ads.its-newid.net/api/manifest.m3u8?ads.service_id=GB17000088V&channel_id=newid_086&tp=samsung_tvplus", "K-drama, films & K-pop"],
    ["Stingray Today's K-Pop", "https://lotus.stingray.com/manifest/ose-317ads-montreal/samsungtvplus/master.m3u8", "K-drama, films & K-pop"],
    ["Kpop Mix", "https://cloud.tvomix.com/KPOPMIX/index.m3u8", "K-drama, films & K-pop"],
    ["CBS TV", "https://cbs-live.cbs.co.kr/cbs-live/_definst_/cbs-live.stream/playlist.m3u8", "Religious"],
    ["LLBN TV Korean", "https://brightstar-korean-pull-secure.akamaized.net/brightstarkorean/stream.m3u8", "Religious"]
  ],
  jp: [
    ["MoviDora TV (films & drama)", "https://cdn-apne1.tsv2.amagi.tv/linear/amg01287-rakutentvjapan-moviecmaf-rakutenjp/playlist.m3u8", "Films & drama"],
    ["Jidaigeki TV (samurai drama)", "https://livetv.fastv.jp/channel_assembly/696074B664B80F46A876/master.m3u8", "Films & drama"],
    ["Hanryu Channel (Korean drama)", "https://livetv.fastv.jp/channel_assembly/6960905473F5101B6A17/master.m3u8", "Films & drama"],
    ["Entame Asia (Asian drama)", "https://livetv.fastv.jp/channel_assembly/696078CF64B81069221E/master.m3u8", "Films & drama"],
    ["Animax Free", "https://livetv.fastv.jp/channel_assembly/69608FB2725E0FA3B972/master.m3u8", "Anime"],
    ["Tezuka Productions TV", "https://cdn-apne1.tsv2.amagi.tv/linear/amg01287-rakutentvjapan-anime5-cmaf-rakutenjp/playlist.m3u8", "Anime"],
    ["RetroCrush (classic anime, English)", "https://linear-899.frequency.stream/dist/cineverse/899/hls/master/playlist.m3u8", "Anime"],
    ["Yu-Gi-Oh! (English)", "https://amg01796-amg01796c19-rakuten-gb-7486.playouts.now.amagi.tv/playlist/amg01796-fastmediafast-yugioh2en-rakutengb/playlist.m3u8", "Anime"],
    ["Lemino TV", "https://livetv.fastv.jp/channel_assembly/696082290000105F1525/master.m3u8", "Entertainment & lifestyle"],
    ["Entertainment News", "https://livetv.fastv.jp/channel_assembly/6960899D64B80F9C740C/master.m3u8", "Entertainment & lifestyle"],
    ["Fashion Plus", "https://livetv.fastv.jp/channel_assembly/69609952725E0FA3B987/master.m3u8", "Entertainment & lifestyle"],
    ["Pia Rakugo (comic storytelling)", "https://livetv.fastv.jp/channel_assembly/69608EE9725E0F73BF30/master.m3u8", "Entertainment & lifestyle"],
    ["What's for Dinner? (cooking)", "https://livetv.fastv.jp/channel_assembly/696095BC725E0FE5F3E9/master.m3u8", "Entertainment & lifestyle"],
    ["Mirutabi (travel)", "https://livetv.fastv.jp/channel_assembly/6960965C64B80F2C027D/master.m3u8", "Entertainment & lifestyle"],
    ["All about Hokkaido", "https://livetv.fastv.jp/channel_assembly/69998D0964B83951E552/master.m3u8", "Entertainment & lifestyle"],
    ["All about Kyushu", "https://livetv.fastv.jp/channel_assembly/696090F573F51039B31F/master.m3u8", "Entertainment & lifestyle"],
    ["Tokai Rokipo", "https://livetv.fastv.jp/channel_assembly/69998DB5725E30535DA6/master.m3u8", "Entertainment & lifestyle"],
    ["Camping & Outdoors", "https://livetv.fastv.jp/channel_assembly/69607E1D725E0FB5AC23/master.m3u8", "Entertainment & lifestyle"],
    ["Pet TV", "https://livetv.fastv.jp/channel_assembly/69551F080000E209AD09/master.m3u8", "Entertainment & lifestyle"],
    ["Wan Nyan (cats & dogs)", "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg01287-rakutentvjapan-pet-cmaf-rakutenjp/playlist.m3u8", "Entertainment & lifestyle"],
    ["Go & Shogi", "https://livetv.fastv.jp/channel_assembly/69998C7B725E30DA4170/master.m3u8", "Entertainment & lifestyle"],
    ["Golf Life", "https://livetv.fastv.jp/channel_assembly/69607D5C725E103DDF9D/master.m3u8", "Entertainment & lifestyle"],
    ["Business Premium", "https://livetv.fastv.jp/channel_assembly/69607EBD725E0F65BEE4/master.m3u8", "Entertainment & lifestyle"],
    ["NHK World Premium", "https://media-tyo.hls.nhkworld.jp/hls/wp/live/master.m3u8", "General"]
  ]
};

// The menu of channel lists (the guide's list chooser), in groups. A list is a ChinaIPTV playlist
// ("file"), iptv-org's international channels ("iptvorg:int"), or a country
// ("country:<code>"). The countries are those with channels that worked when the
// extension was made (IPTV_COUNTRIES, iptv-countries.js, from tools/iptv_check.mjs).
// ChinaIPTV's China lists are in China (IPTV_CHINA, below). Left out of ChinaIPTV:
// its adult list, one marked as not working, a list of other lists, and its
// separate country lists (otherCountry has all of theirs).
// ChinaIPTV's playlists of China's own channels (CCTV, the provinces' satellite
// channels, Hong Kong, Macao and Taiwan...), all part of China in the menu.
const IPTV_CHINA = ["cnTV_AutoUpdate", "cnTV2_GuoNei", "cnTV1_ALL", "cnTV1_GuoJi", "HunanTV_AutoUpdate", "HunanTV1", "HunanTV2"];
const IPTV_MENU = [
  ["News", [["Global", "World news"], ["iptvorg:int", "International channels"]]],
  ["Countries", Object.entries(typeof IPTV_COUNTRIES === "object" ? IPTV_COUNTRIES : {})
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => ["country:" + code, name])]
];
// Lists in earlier versions of the menu, for a choice saved then.
const IPTV_RENAMED = {
  HongKong: "country:hk", Macao: "country:mo", TaiWan: "country:tw", Singapore: "country:sg",
  Japan: "country:jp", southKorea: "country:kr", Russia: "country:ru", UK: "country:uk", USA: "country:us",
  ...Object.fromEntries(IPTV_CHINA.map((file) => [file, "country:cn"]))
};
function iptvListId(id) {
  if (!id) return id;
  if (id.startsWith("otherCountry:")) return "country:" + id.slice(13);
  return IPTV_RENAMED[id] ?? id;
}

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

// Video sites' pages rather than streams (Free-TV lists live YouTube channels):
// the player can't play them.
const NOT_STREAMS = /^https?:\/\/([\w-]+\.)*(youtube\.com|youtu\.be|dailymotion\.com|twitch\.tv|facebook\.com)\//i;

// A channel's name without the playlists' notes: "(720p)", "[Geo-blocked]",
// "[Not 24/7]", and Free-TV's circled letters (geo-blocked, not HD...).
function iptvTidy(name) {
  return name.replace(/\s*\((\d{3,4}p|\d+K)\)/gi, "").replace(/\s*\[[^\]]*\]/g, "")
    .replace(/[\u24B6-\u24E9]/g, "").replace(/\s+/g, " ").trim();
}

// An M3U playlist: [{ name, group, country, url }] for each channel with a
// stream link. The country is Free-TV's tvg-country, or the code on the end of
// the tvg-id ("BBCNews.uk"), if any.
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
      const tagged = line.match(/tvg-country="([^"]*)"/)?.[1].toLowerCase();
      info = {
        name: iptvTidy(comma >= 0 ? line.slice(comma + 1) : ""),
        group: line.match(/group-title="([^"]*)"/)?.[1] ?? "",
        // Free-TV says tvg-country="GB"; the others end the tvg-id with ".uk".
        country: tagged ? (tagged === "gb" ? "uk" : tagged)
          : line.match(/tvg-id="[^"]*\.([a-z]{2})(?:@[\w-]*)?"/i)?.[1].toLowerCase() ?? ""
      };
    } else if (line && !line.startsWith("#")) {
      if (info && /^https?:\/\//i.test(line) && !/\.mpd(\?|$)/i.test(line) && !NOT_STREAMS.test(line)) {
        channels.push({ ...info, url: line });
      }
      info = null;
    }
  }
  return channels;
}

// --- Loading lists and telling dead channels

const IPTV_CACHE_MS = 6 * 3600 * 1000;      // a playlist is fetched again after this long
const IPTV_DEAD_MS = 3 * 24 * 3600 * 1000;  // how long a dead mark hides a channel

// A playlist's text, from the cache in local storage while it's fresh, else
// from the web (or the stale copy if it can't be reached).
async function iptvFetch(url) {
  const key = "iptv:" + url;
  const cached = (await chrome.storage.local.get(key))[key];
  if (cached && Date.now() - cached.at < IPTV_CACHE_MS) return cached.text;
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const text = await res.text();
    chrome.storage.local.set({ [key]: { at: Date.now(), text } }).catch(() => {});
    return text;
  } catch (err) {
    if (cached) return cached.text;
    throw err;
  }
}

// The raw channels of a menu list, from its source(s). A country is every
// source's channels for it; one that can't be reached is left out.
async function iptvSourceChannels(id) {
  if (id === "iptvorg:int") return iptvParse(await iptvFetch(IPTV_ORG + "countries/int.m3u"));
  if (!id.startsWith("country:")) return iptvParse(await iptvFetch(IPTV_REPO + encodeURIComponent(id) + ".m3u8"));
  const code = id.slice(8);
  const extra = (IPTV_EXTRA[code] ?? []).map(([name, url, group]) => ({ name, url, group, country: code }));
  const parts = await Promise.allSettled([
    iptvFetch(IPTV_ORG + `countries/${code}.m3u`).then((t) => iptvParse(t).map((c) => ({ ...c, country: code }))),
    iptvFetch(IPTV_REPO + "otherCountry.m3u8").then((t) => iptvParse(t).filter((c) => c.country === code)),
    // Free-TV's groups are its countries, not kinds of channel: leave them ungrouped.
    iptvFetch(IPTV_FREETV).then((t) => iptvParse(t).filter((c) => c.country === code).map((c) => ({ ...c, group: "" }))),
    // China: ChinaIPTV's own lists too, ahead of the rest for their groups (CCTV, provinces...).
    ...(code === "cn" ? IPTV_CHINA : []).map((file) => iptvFetch(IPTV_REPO + file + ".m3u8").then(iptvParse))
  ]);
  if (code === "cn") parts.unshift(...parts.splice(3));
  if (parts.every((p) => p.status === "rejected") && !extra.length) throw parts[0].reason;
  const found = parts.flatMap((p) => p.status === "fulfilled" ? p.value : []);
  const groups = new Set(found.map((c) => c.group.split(";")[0]));
  const seen = new Set();
  return [...extra.filter((c) => !groups.has(c.group)), ...found, ...extra.filter((c) => groups.has(c.group))]
    .filter((c) => !seen.has(c.url) && seen.add(c.url));
}

// The channels of a menu list, in English and ordered group by group as the
// playlists first mention each group, so stepping through them runs from one
// group into the next.
async function iptvChannels(id) {
  const found = await iptvSourceChannels(id);
  const order = new Map();
  const channels = found.map((c) => {
    const label = iptvEnglish(c.name) || "Unnamed channel";
    const groupLabel = iptvEnglish(c.group.split(";")[0], true);   // a channel's first group
    if (!order.has(groupLabel)) order.set(groupLabel, order.size);
    return { ...c, label, groupLabel, search: `${label} ${c.name} ${groupLabel} ${c.group}`.toLowerCase() };
  });
  return channels.map((c, i) => [order.get(c.groupLabel), i, c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
}

// The channels to show: not dead (the one that's on always shows), and each
// name once, as the sources often list the same channel at different links.
function iptvVisible(channels, health, current, showDead = false) {
  const names = new Set();
  return channels.filter((c) => {
    if (c.url !== current && !showDead && iptvIsDead(c.url, health)) return false;
    const name = c.label.toLowerCase();
    if (names.has(name) && c.url !== current) return false;
    names.add(name);
    return true;
  });
}

// Whether a channel is dead. health is streamHealth from local storage (kept by
// background.js): a recent dead mark, or one found working, from this browser.
// Failing that, the list shipped with the extension (iptv-dead.js) decides.
// Services in its blockedHosts have shut every channel off (Pluto TV plays a
// "C'est fini" clip on each): always dead, whatever a check said.
let iptvKnown = null;
function iptvIsDead(link, health) {
  if (!iptvKnown) {
    const k = typeof IPTV_KNOWN_DEAD === "object" ? IPTV_KNOWN_DEAD : {};
    iptvKnown = { urls: new Set(k.urls ?? []), hosts: k.blockedHosts ?? [], lists: new Set(k.lists ?? []) };
  }
  let host = "";
  try { host = new URL(link).hostname; } catch {}
  if (iptvKnown.hosts.some((b) => host === b || host.endsWith("." + b))) return true;
  const h = health?.[link];
  if (h && (h.ok || Date.now() - h.at < IPTV_DEAD_MS)) return !h.ok;
  return iptvKnown.urls.has(link);
}

// Menu lists with no working channels at all when the extension was made.
function iptvListIsDead(id) {
  iptvIsDead("", null);   // loads the shipped list
  return iptvKnown.lists.has(id);
}
