from html.parser import HTMLParser
from pathlib import Path
class Check(HTMLParser):
 def __init__(self): super().__init__();self.stack=[];self.found=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if attrs.get('id') in ['launchArrow','velocityHead','speedLabel']:
   assert any(a.get('clip-path')=='url(#worldClip)' for _,a in self.stack),attrs['id']+' is outside worldClip'
   self.found.append(attrs['id'])
  if tag not in ['meta','link','input','br','hr','img']: self.stack.append((tag,attrs))
 def handle_startendtag(self,tag,attrs): self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  if self.stack and self.stack[-1][0]==tag:self.stack.pop()
p=Check();p.feed(Path('energy-lab/dist/index.html').read_text(encoding='utf-8'));assert len(p.found)==3
print('PASS: arrow shaft, head and speed label share world clipping')
