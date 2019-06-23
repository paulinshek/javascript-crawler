const axios = require('axios');
const cheerio = require('cheerio')
const http = require('http');
const fs = require('file-system');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  console.log("RECEIVED REQUEST");

  if (req.url == "/") {
    fs.readFile("index.html", 'utf8', (err, data) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(data);
  });
  }

  if (req.url == "/bundle.js") {
    fs.readFile("bundle.js", 'utf8', (err, data) => {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/javascript; charset=utf-8');
      res.end(data);
    });
  }

  if (req.url == "/getData") {
    crawlFrom('https://www.monzo.com')
      .then((data) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        console.log("converting json to string")
        res.end(JSON.stringify(data));
        console.log("returning response");
      })
      .catch((error) => {
        console.log("ERROR during crawl " + error);
      });
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});


crawlFrom = (root) => {
  // kind of global
  // used in recursivelyEvaluatePromiseAndGetAllChildrenLinks
  let urls = [root + "/"];
  let links = [];

  // functions used in recursivelyEvaluatePromiseAndGetAllChildrenLinks
  prefixDomain = prefixDomainCreator(root);
  hasRootDomain = hasRootDomainCreator(root);

  // define inner function
  recursivelyEvaluatePromiseAndGetAllChildrenLinks = url => {
    return axios.get(url)
      .then(response => {
        console.log("have GOT from " + url);
        const $ = cheerio.load(response.data);
        let linksOnPage = $('a').get().map(element => element.attribs.href);

        // tidy up each link
        let tidiedLinks = linksOnPage
          .map(prefixDomain)
          .map(removeFragmentIdentifier)
          .filter(hasRootDomain);

        // add to links
        tidiedLinks.forEach(link => {
          links.push({ source: url, target: link });
        })

        // filter out seen before by checking for containment in nodes
        let neverSeenBeforeLinks = [...new Set(tidiedLinks)]
          .filter(link => !urls.includes(link));

        // add all to urls
        neverSeenBeforeLinks.forEach(link => urls.push(link));
        
        return Promise.all(neverSeenBeforeLinks.map(recursivelyEvaluatePromiseAndGetAllChildrenLinks));
      })
      .catch(error => {
        console.log("ERROR whilst evaluating a link on page " + url + ": " + error);
        return Promise.resolve();
      });
  };


  return recursivelyEvaluatePromiseAndGetAllChildrenLinks(root + "/")
    .then(() => {
      console.log("transforming data");
      let nodes = urls.map((url, index) => {
          return {
            id: url, 
            name: url.substring(root.length) 
        }; 
      });
      let data = {
        nodes: nodes,
        links: links
      };
      console.log(data);
      return data;
    });
}


// some helper functions

removeFragmentIdentifier = link => {
  return link.split("#")[0];
}

prefixDomainCreator = rootDomain => {
  return link => {
    if (link.startsWith("/")) {
      return rootDomain + link;
    } else {
      return link;
    }
  }
}

hasRootDomainCreator = rootDomain => {
  return link => {
    return link.startsWith(rootDomain);
  }
}
