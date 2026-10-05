"""Generate legible, vector UI instruction cards (five logical slides per role)."""
from pathlib import Path
from html import escape
out=Path(__file__).resolve().parents[1]/'public/guides'
def rect(x,y,w,h,fill='#fff',stroke='#d7e2d9',r=18):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
def text(x,y,s,size=30,color='#263d31',weight=500):return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}">{escape(s)}</text>'
def row(y,n,label,sub=''):
 return rect(32,y,576,94)+rect(50,y+20,52,52,'#e9f1e9','none',14)+text(65,y+57,n,28,'#315d48')+text(122,y+40,label,30)+ (text(122,y+73,sub,24,'#637168') if sub else '')
def button(x,y,w,label):return rect(x,y,w,64,'#315d48','#315d48',14)+text(x+22,y+42,label,28,'white')
def header(label):return text(32,52,label,30,'#315d48',600)
def score(personal=False):
 s=rect(64,110,512,328)+text(94,150,'Intro · V · C · Cx2',28,'#315d48',600)
 for top in [195,285,375]:
  for i in range(5):s+=f'<path d="M94 {top+i*9} H546" stroke="#8b988e" stroke-width="2"/>'
 s+=rect(105,245,personal and 255 or 86,44,'#e6eee7','#315d48',8)+text(118,276,'여기서 조용히' if personal else 'V1',26,'#315d48')
 return s
cards={
'leader-1':header('예배 준비')+row(86,'01','예배 날짜','이번 주일')+row(194,'02','본문 말씀','함께 읽을 말씀을 입력')+row(302,'03','연습 안내','모이는 시간과 장소'),
'leader-2':header('필요한 곡만 선택')+row(86,'✓','영광의 주님 찬양하세')+row(194,'✓','은혜')+button(32,302,576,'선택한 곡 불러오기')+text(42,423,'Intro  ·  V  ·  C  ·  Cx2',32,'#315d48',600),
'leader-3':header('악보 · 구간 표시')+score()+rect(32,68,576,42,'#e9f1e9','none',10)+text(48,98,'스크롤    송폼 이동    구간 표시',26,'#315d48'),
'leader-4':header('준비가 끝나면 팀에 공개')+button(32,91,576,'팀에 공개')+row(194,'01','팀원 초대','내 정보 · 우리 교회 찬양팀')+row(302,'02','말씀·송폼 카톡용 복사','음원 링크까지 함께 전달'),
'team-1':header('이번 주')+row(86,'01','찬양 순서','오늘 함께 부를 곡')+row(194,'02','본문 말씀','말씀을 먼저 읽어 보세요')+row(302,'03','연습 안내','시간과 공지를 확인'),
'team-2':header('공통 송폼 + 나만의 메모')+score(True),
'team-3':header('전체화면 합주')+rect(32,90,576,320)+text(60,144,'01  영광의 주님 찬양하세',30,'#315d48',600)+''.join(f'<path d="M65 {180+i*16}H575" stroke="#8b988e" stroke-width="2"/>' for i in range(8))+rect(58,335,522,53,'#e9f1e9','none',12)+text(80,371,'다음 곡  ·  은혜',28),
'team-4':header('함께 나누고 다시 찾아요')+rect(32,90,576,144)+text(58,134,'소통',32,'#315d48',600)+text(58,184,'이 부분은 어떻게 연주하나요?',28)+rect(32,256,576,144)+text(58,301,'악보도서관',32,'#315d48',600)+text(58,352,'날짜 · 곡 이름으로 검색',28)
}
for role in ['leader','team']:
 for platform,names in {'ios':['Safari에서 열기','공유 · 홈 화면에 추가','앱 아이콘으로 실행'], 'android':['Chrome에서 열기','메뉴 · 앱 설치','앱 아이콘으로 실행'], 'desktop':['Chrome / Edge에서 열기','브라우저의 앱 설치','설치한 앱으로 실행']}.items():
  cards[f'{role}-5-{platform}']=header('생명의 찬양 · 설치 안내')+''.join(row(86+i*108,str(i+1).zfill(2),label) for i,label in enumerate(names))
for name,body in cards.items():
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" rx="24" fill="#f2f6f1"/><g font-family="Apple SD Gothic Neo,Noto Sans KR,Arial,sans-serif">{body}</g></svg>'
 (out/f'{name}.svg').write_text(svg)
print(f'{len(cards)} SVG assets generated')
