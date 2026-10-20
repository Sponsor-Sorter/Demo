const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');fs.mkdirSync(root+'/www',{recursive:true});fs.copyFileSync(root+'/offline.html',root+'/www/index.html');
