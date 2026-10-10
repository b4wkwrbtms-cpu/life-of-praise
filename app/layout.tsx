import type {Metadata} from 'next';
import './globals.css';
import './design-system.css';
import './editorial.css';
import './mobile.css';
export const metadata:Metadata={title:'생명의 찬양 | 우리 찬양팀의 악보 공간',description:'이번 주 말씀, 송폼과 악보. 각자의 연주 표시를 더하고 날짜별로 함께 보관하는 찬양팀 공간.',icons:{icon:'/favicon.svg',apple:'/icon-192.png'},manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'생명의 찬양',statusBarStyle:'default'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
