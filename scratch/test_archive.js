async function checkMetadata(id) {
  try {
    const url = `https://archive.org/metadata/${id}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(`\n=== Files for ${id} ===`);
    const mp3Files = data.files.filter(f => f.name.endsWith('.mp3'));
    mp3Files.forEach(f => {
      console.log(`- ${f.name} (size: ${f.size} bytes)`);
    });
  } catch (err) {
    console.error(`Error checking ${id}:`, err.message);
  }
}

async function run() {
  await checkMetadata('BASERAP6_20180209');
  await checkMetadata('BASERAP6_201802');
  await checkMetadata('its-no-fair');
}

run();
