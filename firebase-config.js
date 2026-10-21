/* 作品原価帳 の Firebase 設定
   SETUP.md の手順で作った Firebase プロジェクトの設定を、下の firebase: { ... } に貼り付けてください。
   ここが空（null）のままだと、ページは「この端末に保存するモード」で動きます。
   この設定はページを開く人なら誰でも見られる公開情報です（パスワードではありません）。
   書き込みの制限は firestore.rules で行います。 */
window.GENKA_CONFIG = {
  firebase: {
    apiKey: "AIzaSyDzqV2bHrbLz5IrttF-tLb-97q-pgyUhwA",
    authDomain: "genka-book.firebaseapp.com",
    projectId: "genka-book",
    storageBucket: "genka-book.firebasestorage.app",
    messagingSenderId: "145676318030",
    appId: "1:145676318030:web:0a752ee2a006005f8ada1f",
    measurementId: "G-Q9DTKT7MMB"
  },
  // 例：
  // firebase: {
  //   apiKey: "AIza...",
  //   authDomain: "your-project.firebaseapp.com",
  //   projectId: "your-project",
  //   storageBucket: "your-project.appspot.com",
  //   messagingSenderId: "1234567890",
  //   appId: "1:1234567890:web:abcdef"
  // },

  // 作成者（管理タブを使う人）のGoogleアカウントのメールアドレス。firestore.rules にも同じものを書きます。
  ownerEmails: ["liaowujiang940@gmail.com"]
};
