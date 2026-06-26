import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const LOGOS = {
  darkjail: 'https://scontent.cdninstagram.com/v/t51.82787-19/642121863_18408782506133134_1243457411517792902_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=109&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4zMjAuQzMifQ%3D%3D&_nc_ohc=Pc_iG-n9u8QQ7kNvwHMTLXg&_nc_oc=AdrLZDOn5hhcaibrhDXmFDq5a7Vl5pMhOiGHfL1TfjzMkQYIiB6G4Fzl3Kn0eYi6Img&_nc_zt=24&_nc_ht=scontent.cdninstagram.com&_nc_gid=qkJBFCdU3lGGpWVzyfv9cg&_nc_ss=7b689&oh=00_Af-PNN36eRs80oKeHxtE0cgA94hrhU1ktUkDDloq7lYieg&oe=6A420740',
  antagfree: 'https://scontent.cdninstagram.com/v/t51.82787-19/671138048_17922244233298197_1146056477566064754_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=109&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=DlfxhgkPN2oQ7kNvwHPJUsI&_nc_oc=AdoIV7OopVC6GSsV4HEYvYS0REx3F6pz2xeSqvvUQJrxL162DzaZKpdWDx2Cv7wdnqA&_nc_zt=24&_nc_ht=scontent.cdninstagram.com&_nc_gid=qPTs_9zqC7Wyfceu8Sb6rQ&_nc_ss=7b689&oh=00_Af8AtzHwAEN_azbl0RmzML7NklqqoxBN6wAsg9f-5jYdEw&oe=6A42017A',
  redbullbatalla: 'https://instagram.fmvd1-1.fna.fbcdn.net/v/t51.82787-19/589124016_18510275359068407_8486682256612648115_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fmvd1-1.fna.fbcdn.net&_nc_cat=1&_nc_oc=Q6cZ2gEwcgByoXZhMQeHulzWQe62syOVO_72u-yMoAtRC9hmPr6JOeK1hYQzWlDQ4Owc0mE&_nc_ohc=aWNIs7FQbtkQ7kNvwH4sWaC&_nc_gid=nG9fSEXaL_pV7_-RyNAgaQ&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af8YUja3OnGmLp9ELz3luUD6Fiq1KybU1JHSNibSTQZ3jQ&oe=6A41F868&_nc_sid=8b3546'
};

async function download(url, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.statusText}`);
  }

  const fileStream = fs.createWriteStream(dest);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
  console.log(`Successfully downloaded to ${dest}`);
}

async function run() {
  for (const [name, url] of Object.entries(LOGOS)) {
    const dest = path.resolve('public', 'images', 'logos', `${name}.jpg`);
    try {
      await download(url, dest);
    } catch (err) {
      console.error(`Error downloading ${name}:`, err.message);
    }
  }
}

run();
