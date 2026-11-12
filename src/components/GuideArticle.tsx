import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {guideHeadings,guideUrl,type PlayerGuide} from '../lib/player-guides';
export default function GuideArticle({guide}:{guide:PlayerGuide}){
 const headings=guideHeadings(guide);
 const heading=(line?:number)=>headings.find(h=>h.line===line)?.id;
 return <div className="guide-prose"><Markdown skipHtml remarkPlugins={[remarkGfm]} urlTransform={url=>url} components={{
  a:({href,children})=>{const url=guideUrl(href??'',guide);return url?<a href={url} {...(!url.startsWith('#')?{target:'_blank',rel:'noopener noreferrer'}:{})}>{children}</a>:<span>{children}</span>;},
  img:({src,alt})=>{const url=guideUrl(typeof src==='string'?src:'',guide,true);return url?<a className="guide-illustration" href={url} target="_blank" rel="noopener noreferrer">View illustration{alt&&!/^https?:/.test(alt)?`: ${alt}`:''} ↗</a>:null;},
  h1:({node,children})=><h4 tabIndex={-1} id={heading(node?.position?.start.line)}>{children}</h4>,
  h2:({node,children})=><h4 tabIndex={-1} id={heading(node?.position?.start.line)}>{children}</h4>,
  h3:({node,children})=><h5 tabIndex={-1} id={heading(node?.position?.start.line)}>{children}</h5>,
  h4:({node,children})=><h6 tabIndex={-1} id={heading(node?.position?.start.line)}>{children}</h6>,
  h5:({node,children})=><h6 tabIndex={-1} id={heading(node?.position?.start.line)}>{children}</h6>,
  h6:({node,children})=><h6 tabIndex={-1} id={heading(node?.position?.start.line)}>{children}</h6>,
 }}>{guide.body}</Markdown></div>;
}
