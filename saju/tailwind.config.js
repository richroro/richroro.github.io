// 만세력 페이지 스타일 빌드 설정. 클래스를 바꾸면 saju/ 에서 다시 빌드한다:
//   npx tailwindcss@3 -c tailwind.config.js -i tailwind.src.css -o tw.css --minify
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
module.exports = {
  content: ['./index.html', './app.js'],
  theme: {
    extend: {
      colors: Object.fromEntries(
        ['paper', 'card', 'ink', 'ink2', 'ink3', 'line', 'seal', 'wood', 'fire', 'earth', 'metal', 'water'].map((n) => [n, v(n)])
      ),
      fontFamily: {
        serif: ['"Noto Serif KR"', 'serif'],
        sans: ['"IBM Plex Sans KR"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'system-ui', 'sans-serif']
      }
    }
  }
};
