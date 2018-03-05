using HtmlAgilityPack;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace StockFlow.Trader
{

    public class Flatex : IBroker
    {
        public void Login(string user, string password, ChromeDriver chrome)
        {
            chrome.Navigate().GoToUrl("https://www.flatex.de/kunden-login/");

            chrome.FindElementById("uname_app").SendKeys(user);
            chrome.FindElementById("password_app").SendKeys(password);

            if (chrome.FindElementById("sessionpass").Selected)
                chrome.FindElementById("sessionpass").Click();

            chrome.FindElementByXPath("//*[@id='webfiliale_login']//div[@title='Anmelden']").Click();

            var wait = new WebDriverWait(chrome, TimeSpan.FromSeconds(30));
            wait.Until(x => x.FindElement(By.XPath("//tr[td/text()='Gesamt Verfügbar']/td/table/tbody/tr/td/span[text()!='']")));
        }

        public decimal GetAvailableFunds(ChromeDriver chrome)
        {
            chrome.Navigate().GoToUrl("https://konto.flatex.de/banking-flatex");

            var xpath = "//div[@id='accountOverviewForm_accountOverviewTableSmall']/div/div/div[div/text()='Cashkonto']/div[contains(@class,'SimpleBalance')]/span";
            var checkElement = WaitForElementByXPath(chrome, xpath, element =>
            {
                var x = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(x);
            });

            var refreshXpath = "//a[@id='accountOverviewForm_refreshButton']";
            var refreshButton = WaitForElementByXPath(chrome, refreshXpath, x => true);
            if (refreshButton == null)
            {
                throw new Exception("Could not find refresh button");
            }

            refreshButton.Click();

            Thread.Sleep(5000);

            var quantityElement = WaitForElementByXPath(chrome, xpath, element =>
            {
                var x = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(x);
            });

            if (quantityElement == null)
            {
                throw new Exception("Could not find funds element");
            }

            var fundsText = quantityElement.GetAttribute("innerText");

            var regex = new Regex("^([\\d\\.]+)(,(\\d{0,3}))?(&nbsp;|\\s+)EUR$");
            var match = regex.Match(fundsText);
            if (match.Success)
            {
                var euros = match.Groups[1].Value.Replace(".", "");
                var cents = match.Groups[3].Value;
                var amount = decimal.Parse(euros + "." + cents, CultureInfo.InvariantCulture);
                return amount;
            }
            else
            {
                throw new Exception("Available funds cannot be parsed from " + fundsText);
            }
        }

        public int GetOwnedQuantity(string isin, string wkn, ChromeDriver chrome)
        {
            var menu = WaitForElementByXPath(chrome, "//td[@id='menu_overviewMenu']", x => true);
            if (menu == null)
            {
                throw new Exception("Could not find main menu element");
            }

            menu.Click();

            var submenu = WaitForElementByXPath(chrome, "//td[@id='menu_overviewMenu']/div/div[text()='Depotbestand']", x => true);
            if (submenu == null)
            {
                throw new Exception("Could not find Depotbestand menu element");
            }

            submenu.Click();

            var refreshXpath = "//a[@id='depositStatementForm_refreshButton']";
            var refreshButton = WaitForElementByXPath(chrome, refreshXpath, x => x.Displayed);
            if (refreshButton == null)
            {
                throw new Exception("Could not find refresh button");
            }

            refreshButton.Click();

            Thread.Sleep(5000);

            var sb = new StringBuilder();
            if (!string.IsNullOrEmpty(isin))
            {
                var tdIsin = string.Format("//table[@id='depositStatementForm_depositStatementTable']/tbody/tr/td/table/tbody/tr/td/table/tbody[contains(tr/td/a/text(),'{0}')]/../..", isin);
                sb.Append(tdIsin);
            }

            if (!string.IsNullOrEmpty(wkn))
            {
                if (sb.Length > 0)
                {
                    sb.Append(" | ");
                }

                var tdWkn = string.Format("//table[@id='depositStatementForm_depositStatementTable']/tbody/tr/td/table/tbody/tr/td/table/tbody/tr/td[contains(text(),'{0}')]/../../../..", wkn);
                sb.Append(tdWkn);
            }

            var xpath = string.Format("({0})/../preceding-sibling::tr[1]/td[2]/span", sb.ToString());
            var quantityElement = WaitForElementByXPath(chrome, xpath, element =>
            {
                var x = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(x);
            });

            if (quantityElement == null)
            {
                return 0;
            }

            var text = quantityElement.GetAttribute("innerText");

            var regex = new Regex("^([\\d\\.]+)(,(\\d{0,3}))? Stk.$");
            var match = regex.Match(text);
            if (match.Success)
            {
                var whole = match.Groups[1].Value.Replace(".", "");
                var fractions = match.Groups[3].Value;
                var amount = decimal.Parse(whole + "." + fractions, CultureInfo.InvariantCulture);
                return (int)amount;
            }
            else
            {
                throw new Exception("Quantity cannot be parsed from " + text);
            }
        }

        public decimal GetPrice(string isin, TradingAction action, ChromeDriver chrome)
        {
            var menuButton = chrome.FindElementById("ToggleSearchButton");
            if (menuButton != null && menuButton.Displayed)
            {
                menuButton.Click();

                var wait2 = new WebDriverWait(chrome, TimeSpan.FromSeconds(30));
                wait2.Until(x => x.FindElement(By.Id("headerAreaForm_searchEditFieldWidget_editField")));
            }

            chrome.FindElementById("headerAreaForm_searchEditFieldWidget_editField").SendKeys(isin);

            chrome.FindElementById("headerAreaForm_searchEditFieldWidget_searchButton").Click();

            string xpath;
            switch (action)
            {
                case TradingAction.Buy:
                    xpath = "//table[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table[2]/tbody/tr[contains(td/div/text(),'flatex Preis')]/td[count(//*[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table[2]/thead/tr[1]/td[div/a/text()='Brief']/preceding-sibling::*)+1]/span[text()!='']";
                    break;
                case TradingAction.Sell:
                    xpath = "//table[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table[2]/tbody/tr[contains(td/div/text(),'flatex Preis')]/td[count(//*[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table[2]/thead/tr[1]/td[div/a/text()='Geld']/preceding-sibling::*)+1]/span[text()!='']";
                    break;
                default:
                    throw new Exception("Unknown trading action " + action);
            }

            var priceElement = WaitForElementByXPath(chrome, xpath, element =>
            {
                var text = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(text);
            });

            if (priceElement == null)
            {
                throw new Exception("Price element was not found");
            }

            var priceText = priceElement.GetAttribute("innerText");

            var regex = new Regex("^([\\d\\.]+)(,(\\d{0,3}))?$");
            var match = regex.Match(priceText);
            if (match.Success)
            {
                var euros = match.Groups[1].Value.Replace(".", "");
                var cents = match.Groups[3].Value;
                var amount = decimal.Parse(euros + "." + cents, CultureInfo.InvariantCulture);
                return amount;
            }
            else
            {
                throw new Exception("Price cannot be parsed from " + priceText);
            }
        }

        public object GetTanChallenge(int quantity, TradingAction action, ChromeDriver chrome)
        {
            string xpath;
            if (chrome.FindElement(By.ClassName("DisplayMode-Large")).Displayed)
            {
                switch (action)
                {
                    case TradingAction.Buy:
                        xpath = "//table[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table[2]/tbody/tr[contains(td/div/text(),'flatex Preis')]/td/table/tbody/tr/td/input[@value='K']";
                        break;
                    case TradingAction.Sell:
                        xpath = "//table[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table[2]/tbody/tr[contains(td/div/text(),'flatex Preis')]/td/table/tbody/tr/td/input[@value='V']";
                        break;
                    default:
                        throw new Exception("Unknown trading action " + action);
                }
            }
            else
            {
                var row = chrome.FindElementByXPath("//div[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTableSmall']/div/div[div/div/div[contains(text(),'flatex Preis')]]");
                row.Click();

                switch (action)
                {
                    case TradingAction.Buy:
                        xpath = "//div[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTableSmall']/div/div[div/div/div[contains(text(),'flatex Preis')]]/div/div/div/input[@value='K']";
                        break;
                    case TradingAction.Sell:
                        xpath = "//div[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTableSmall']/div/div[div/div/div[contains(text(),'flatex Preis')]]/div/div/div/input[@value='V']";
                        break;
                    default:
                        throw new Exception("Unknown trading action " + action);
                }
            }

            var wait = new WebDriverWait(chrome, TimeSpan.FromSeconds(30));
            wait.Until(x => x.FindElement(By.XPath(xpath)));

            var tradeButton = chrome.FindElementByXPath(xpath);
            tradeButton.Click();

            var priceElement = WaitForElementById(chrome, "paperOrderSubmissionForm_quantity_amountEditField", element => true);

            chrome.FindElementById("paperOrderSubmissionForm_quantity_amountEditField").SendKeys(quantity.ToString());

            chrome.FindElementById("paperOrderSubmissionForm_transactionFlowSubForm_nextButton").Click();

            var challengeXpath = "//*[@id='paperOrderSubmissionForm_transactionSecuritySubForm_tanLabel']/table/tbody/tr/td[contains(@class,'Challenge')]";
            var challengeElement = WaitForElementByXPath(chrome, challengeXpath, element =>
            {
                var text = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(text);
            });
            if (challengeElement == null)
            {
                throw new Exception("Could not find TAN challenge element");
            }

            var challengeText = challengeElement.GetAttribute("innerText");

            var result = new TanChallenge();

            var regex = new Regex("^([A-M][1-9]) ([A-M][1-9]) ([A-M][1-9])$");
            var match = regex.Match(challengeText);
            if (match.Success)
            {
                result.TanChallenge1 = match.Groups[1].Value;
                result.TanChallenge2 = match.Groups[2].Value;
                result.TanChallenge3 = match.Groups[3].Value;
            }
            else
            {
                throw new Exception("TAN challenge cannot be parsed from " + challengeText);
            }

            return result;
        }

        public decimal GetQuote(string tan, ChromeDriver chrome)
        {
            var wait = new WebDriverWait(chrome, TimeSpan.FromSeconds(30));
            wait.Until(x => x.FindElement(By.Id("paperOrderSubmissionForm_transactionSecuritySubForm_tan")));

            chrome.FindElementById("paperOrderSubmissionForm_transactionSecuritySubForm_tan").SendKeys(tan);

            chrome.FindElementById("paperOrderSubmissionForm_quoteButton").Click();

            var priceXpath = "//div[@id='PaperOrder_Quote']/div/div[@class='Value']";
            var priceElement = WaitForElementByXPath(chrome, priceXpath, element =>
            {
                var text = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(text);
            });

            if (priceElement == null)
            {
                var element = chrome.FindElementByXPath("[@id=paperOrderSubmissionForm_transactionSecuritySubForm_tan_validationErrorText]");
                if (element != null)
                {
                    var error = element.GetAttribute("innerText");
                    if (!string.IsNullOrEmpty(error))
                    {
                        throw new Exception("Error message from broker: " + error);
                    }
                    else
                    {
                        throw new Exception("Could not get offer");
                    }
                }
            }

            var priceText = priceElement.GetAttribute("innerText");

            var regex = new Regex("^([\\d\\.]+)(,(\\d{0,3}))?(&nbsp;|\\s+)EUR$");
            var match = regex.Match(priceText);
            if (match.Success)
            {
                var euros = match.Groups[1].Value.Replace(".", "");
                var cents = match.Groups[3].Value;
                var amount = decimal.Parse(euros + "." + cents, CultureInfo.InvariantCulture);
                return amount;
            }
            else
            {
                throw new Exception("Offer cannot be parsed from " + priceText);
            }
        }

        public void PlaceOrder(ChromeDriver chrome)
        {
            var button = WaitForElementById(chrome, "paperOrderSubmissionForm_transactionFlowSubForm_nextButton", x => true);
            if (button == null)
            {
                throw new Exception("Order button not found");
            }

            if (!button.Displayed)
            {
                throw new CancelOrderException(Status.TemporaryError, "Order button not visible");
            }

            button.Click();

            var messageElement = WaitForElementByXPath(chrome, "//div[@id='TransactionDetailsComponent']/div/div[contains(@class,'Title')]", element =>
            {
                if (!element.Displayed)
                {
                    return false;
                }

                var text = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(text);
            });

            if (messageElement != null)
            {
                var message = messageElement.GetAttribute("innerText");
                if (message.Contains("wurde ausgeführt"))
                {
                    return;
                }

                throw new Exception("Order was not confirmed as expected: " + message);
            }

            var errorElement = WaitForElementByXPath(chrome, "//*[@id='serverErrors']/div/table/tbody/tr/td[2]/ul/li", element =>
            {
                if (!element.Displayed)
                {
                    return false;
                }

                var text = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(text);
            });

            if (errorElement != null)
            {
                throw new Exception("Error message from broker: " + errorElement.GetAttribute("innerText"));
            }
        }

        public void Logout(ChromeDriver chrome)
        {
            var menuButton = chrome.FindElementById("OpenMobileMenuIcon");
            if (menuButton != null && menuButton.Displayed)
            {
                menuButton.Click();

                var wait2 = new WebDriverWait(chrome, TimeSpan.FromSeconds(30));
                wait2.Until(x => x.FindElement(By.XPath("//div[@data-widgetname='sessionControlComponentMobile.logoutLink']")));

                chrome.FindElementByXPath("//div[@data-widgetname='sessionControlComponentMobile.logoutLink']").Click();
            }
            else
            {
                var wait2 = new WebDriverWait(chrome, TimeSpan.FromSeconds(30));
                wait2.Until(x => x.FindElement(By.XPath("//div[@data-widgetname='sessionControlComponent.logoutLink']")));

                chrome.FindElementByXPath("//div[@data-widgetname='sessionControlComponent.logoutLink']").Click();
            }

            WaitForElementByXPath(chrome, "//li[contains(text(),'abgemeldet')]", x => true);
        }

        private static IWebElement WaitForElementByXPath(ChromeDriver chrome, string xpath, Func<IWebElement, bool> validate)
        {
            for (int i = 0; i < 200; i++)
            {
                Thread.Sleep(100);

                try
                {
                    var element = chrome.FindElementByXPath(xpath);
                    if (element == null)
                    {
                        continue;
                    }

                    if (validate(element))
                    {
                        return element;
                    }
                }
                catch (Exception ex)
                {
                    continue;
                }
            }

            return null;
        }

        private static IWebElement WaitForElementById(ChromeDriver chrome, string id, Func<IWebElement, bool> validate)
        {
            for (int i = 0; i < 300; i++)
            {
                Thread.Sleep(100);

                try
                {
                    var element = chrome.FindElementById(id);
                    if (element == null)
                    {
                        continue;
                    }

                    if (validate(element))
                    {
                        return element;
                    }
                }
                catch (Exception ex)
                {
                    continue;
                }
            }

            return null;
        }

        public class TanChallenge
        {
            public string TanChallenge1;
            public string TanChallenge2;
            public string TanChallenge3;

            public override string ToString()
            {
                return string.Format("{0} {1} {2}", TanChallenge1, TanChallenge2, TanChallenge3);
            }
        }
    }
}
