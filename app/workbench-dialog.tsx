'use client';
import type {ComponentProps} from 'react';
import {DialogContent} from '@/components/ui/dialog';

// Viewport-sized workbenches must never inherit a centered dialog's -50% offset.
// Remove the utility classes as well as setting explicit coordinates: Safari can
// otherwise retain individual translate values during dialog/viewport changes.
export default function WorkbenchDialog({className='',style,...props}:ComponentProps<typeof DialogContent>){
 return <DialogContent {...props} className={'inset-0 translate-x-0 translate-y-0 data-[state=open]:animate-none data-[state=closed]:animate-none '+className} style={{...style,position:'fixed',inset:0,top:0,left:0,right:0,bottom:0,margin:0,transform:'none',translate:'0px 0px',animation:'none'}}/>;
}
