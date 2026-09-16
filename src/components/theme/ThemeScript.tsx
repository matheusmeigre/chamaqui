/**
 * Resolve o tema antes da primeira pintura. Sem isto, uma sessão em modo
 * escuro pisca branco a cada navegação — o clássico "flash of wrong theme".
 *
 * A preferência guardada é "light" | "dark" | "system"; o atributo gravado no
 * <html> é sempre concreto, então o CSS só precisa olhar para data-theme.
 */
export const THEME_STORAGE_KEY = "chamaqui-theme";

const script = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var p=localStorage.getItem(k)||"system";
var d=window.matchMedia("(prefers-color-scheme: dark)").matches;
var t=p==="system"?(d?"dark":"light"):p;
document.documentElement.setAttribute("data-theme",t);
document.documentElement.style.colorScheme=t;
}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
