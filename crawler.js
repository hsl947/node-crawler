const Crawler = require("crawler");
const fs = require("fs");
const http = require("http");
const path = require("path");
const rootPath = './game'

// 递归创建目录 同步方法
function mkdirsSync(dirname) {
  if (fs.existsSync(dirname)) {
    return true;
  } else {
    if (mkdirsSync(path.dirname(dirname))) {
      fs.mkdirSync(dirname);
      return true;
    }
  }
}

// 根目录不存在的话，创建
if (!fs.existsSync(rootPath)) {
  mkdirsSync(rootPath);
}

// 获取css文件路径，用于下载
const getCssUrl = (html) => {
  // 匹配 link（g表示匹配所有结果i表示区分大小写）
  const imgReg = /<(link).*?(?:>|\/>)/gi;
  // 匹配 href 属性
  const srcReg = /href=['"]?([^'"]*)['"]?/i;
  const arr = html.match(imgReg);
  if (!arr) return null;
  // 获取地址
  const urlArr = arr.reduce((prev, next) => {
    const src = next.match(srcReg);
    return src[1] ? [...prev, src[1]] : prev;
  }, []);
  return urlArr.filter((_) => _.includes(".css"));
};

// 获取 css内容并保存
const getCss = new Crawler({
  maxConnections: 10,
  jQuery: false,
  // This will be called for each crawled page
  callback: (error, res, done) => {
    if (error) {
      console.log('error1', error);
    } else {
      const html = res.body;
      const filename = res.options.filename;
      const staticPath =`${rootPath}/_nuxt`

      if (!fs.existsSync(staticPath)) {
        mkdirsSync(staticPath);
      }
      if(filename.includes('/')) {
        const arr = filename.split('/')
        const innerFolder = arr.reduce((prev, next)=>{
          return next.includes('.css') ? prev : `${prev}/${next}`
        }, '')
        mkdirsSync(`./${staticPath}${innerFolder}`)
      }
      fs.writeFile(`./${staticPath}/${filename}`, html, (error) => {
        error && console.log('error2', error);
      })
    }
    done();
  },
});

// 获取 html页面内容并保存
const getPage = new Crawler({
  maxConnections: 10,
  // This will be called for each crawled page
  callback: (error, res, done) => {
    if (error) {
      console.log('error3', error);
    } else {
      const html = res.body;
      const filename = res.options.filename;
      // 只匹配 __NUXT：/<script>[\s\S]+?<\/script>/g
      fs.createWriteStream(`./${rootPath}/${filename}`).write(
        html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/\/_nuxt\//g, './_nuxt/')
      );

      console.log(`当前抓取的页面为：${filename}`)

      const cssArr = getCssUrl(html)
      cssArr && cssArr.forEach((item) => {
        if(!fs.existsSync(item)) {
          getCss.queue({
            uri: `https://www.shangniu.cn${item}`,
            filename: item.substring(7).split('?')[0],
          });
        }
      });
    }
    done();
  },
});

const opt = {
  host: "slbapi.shangniu.cn",
  method: "GET",
  path: "/api/battle/common/getUrlList",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
  },
};

const params = JSON.stringify({ gameType: "" });

// 获取要爬的页面地址数组
const fetch = () => {
  return new Promise((resolve, reject) => {
    let urlList = "";
    const req = http
      .request(opt, (res) => {
        res
          .on("data", (data) => {
            urlList += data;
          })
          .on("end", () => {
            urlList = JSON.parse(urlList).body;
            resolve(urlList);
          });
      })
      .on("error", (e) => {
        reject(e);
      });
    req.write(params);
    req.end();
  });
};

fetch()
  .then((res) => {
    // console.log('res: ', res);

    for(let uri of res) {
      const arr = uri.split("/");
      const filename = `${arr[4]}-${arr[5]}.html`
      // 文件已存在就跳过
      if(fs.existsSync(`./${rootPath}/${filename}`)) continue;
      getPage.queue({
        uri,
        filename
      });
    }

    // for (let k = 0; k < 3; k++) {
    //   const arr = res[k].split("/");
    //   getPage.queue({
    //     uri: res[k],
    //     filename: `${arr[4]}-${arr[5]}.html`
    //   });
    // }

  })
  .catch((err) => {
    console.log("err: ", err);
  });
